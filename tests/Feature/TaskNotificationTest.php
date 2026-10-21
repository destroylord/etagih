<?php

use App\Models\Client;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Task;
use App\Models\User;
use App\Notifications\Tasks\TaskAssigned;
use App\Notifications\Tasks\TaskCommented;
use App\Notifications\Tasks\TaskDueSoon;
use App\Notifications\Tasks\TaskOverdue;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    Setting::query()->updateOrCreate(['id' => 1], ['app_invoice_prefix' => 'INV', 'company_name' => 'Studio Uji']);

    $this->admin = User::factory()->create(['name' => 'Admin']);
    $this->staff = User::factory()->state(['role' => 'staff'])->create(['name' => 'Staf']);
    $this->project = Project::create(['client_id' => Client::create(['name' => 'Klien'])->id, 'name' => 'Toko Online']);
    $this->project->members()->attach($this->staff);
});

it('notifies a new assignee but not when assigning yourself', function () {
    Notification::fake();
    $this->actingAs($this->admin);

    $this->post(route('tasks.store'), ['project_id' => $this->project->id, 'title' => 'Desain', 'assignee_id' => $this->staff->id]);
    Notification::assertSentTo($this->staff, TaskAssigned::class, fn (TaskAssigned $n, array $channels) => $channels === ['database', 'mail']
        && $n->toArray($this->staff)['url'] === '/tasks?task='.$n->task->id
        && str_contains($n->toArray($this->staff)['body'], 'Admin menugaskan'));

    $this->post(route('tasks.store'), ['project_id' => $this->project->id, 'title' => 'Sendiri', 'assignee_id' => $this->admin->id]);
    Notification::assertNotSentTo($this->admin, TaskAssigned::class);

    // Ganti penerima → penerima baru diberi tahu.
    $task = Task::where('title', 'Sendiri')->sole();
    $this->put(route('tasks.update', $task), ['assignee_id' => $this->staff->id]);
    Notification::assertSentToTimes($this->staff, TaskAssigned::class, 2);
});

it('notifies assignee and creator on comments, excluding the commenter', function () {
    Notification::fake();
    $task = Task::factory()->create(['project_id' => $this->project->id, 'created_by' => $this->admin->id, 'assignee_id' => $this->staff->id]);

    $this->actingAs($this->staff)->post(route('tasks.comments.store', $task), ['body' => 'Sudah selesai desain']);

    Notification::assertSentTo($this->admin, TaskCommented::class, fn (TaskCommented $n) => $n->toArray($this->admin)['body'] === 'Staf: Sudah selesai desain');
    Notification::assertNotSentTo($this->staff, TaskCommented::class);
});

it('only uses the database channel when email notifications are off', function () {
    Notification::fake();
    $this->staff->forceFill(['notify_email' => false])->save();
    $this->actingAs($this->admin);

    $this->post(route('tasks.store'), ['project_id' => $this->project->id, 'title' => 'Desain', 'assignee_id' => $this->staff->id]);

    Notification::assertSentTo($this->staff, TaskAssigned::class, fn ($n, array $channels) => $channels === ['database']);
});

it('stores database notifications and exposes them via the endpoints', function () {
    Mail::fake();
    $this->actingAs($this->admin);
    $this->post(route('tasks.store'), ['project_id' => $this->project->id, 'title' => 'Desain', 'assignee_id' => $this->staff->id]);

    expect($this->staff->fresh()->unreadNotifications()->count())->toBe(1);

    $this->actingAs($this->staff)->get(route('tasks.index'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.unreadNotifications', 1)->where('auth.can.manageClients', false));

    $response = $this->actingAs($this->staff)->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonPath('unread_count', 1)
        ->assertJsonPath('notifications.0.type', 'task_assigned')
        ->assertJsonPath('notifications.0.read_at', null);
    $id = $response->json('notifications.0.id');
    expect($response->json('notifications.0.url'))->toStartWith('/tasks?task=');

    $this->actingAs($this->staff)->postJson(route('notifications.read', $id))->assertJsonPath('unread_count', 0);
    expect($this->staff->fresh()->unreadNotifications()->count())->toBe(0);

    // Notifikasi milik orang lain tidak bisa disentuh.
    $this->actingAs($this->admin)->postJson(route('notifications.read', $id))->assertNotFound();

    $this->actingAs($this->admin)->post(route('tasks.store'), ['project_id' => $this->project->id, 'title' => 'Lagi', 'assignee_id' => $this->staff->id]);
    $this->actingAs($this->staff)->post(route('notifications.read-all'))->assertRedirect();
    expect($this->staff->fresh()->unreadNotifications()->count())->toBe(0);
});

it('never notifies inactive users', function () {
    Notification::fake();
    $inactive = User::factory()->state(['role' => 'staff', 'is_active' => false])->create();
    $task = Task::factory()->create([
        'project_id' => $this->project->id, 'created_by' => $inactive->id, 'assignee_id' => $inactive->id,
        'due_date' => now()->addDay()->toDateString(),
    ]);

    $this->actingAs($this->admin)->post(route('tasks.comments.store', $task), ['body' => 'Halo']);
    $this->artisan('tasks:remind')->assertSuccessful();

    Notification::assertNothingSentTo($inactive);
});

it('sends due-soon and overdue reminders once', function () {
    Notification::fake();
    $soon = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'due_date' => now()->addDay()->toDateString()]);
    $late = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'due_date' => now()->subDay()->toDateString()]);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'due_date' => now()->subDay()->toDateString(), 'status' => 'done']);
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->staff->id, 'due_date' => now()->subDays(30)->toDateString()]);
    Task::factory()->create(['project_id' => $this->project->id, 'due_date' => now()->addDay()->toDateString()]);

    $this->artisan('tasks:remind')->assertSuccessful();
    $this->artisan('tasks:remind')->assertSuccessful();

    Notification::assertSentToTimes($this->staff, TaskDueSoon::class, 1);
    Notification::assertSentToTimes($this->staff, TaskOverdue::class, 1);
    Notification::assertSentTo($this->staff, TaskDueSoon::class, fn (TaskDueSoon $n) => $n->task->is($soon));
    Notification::assertSentTo($this->staff, TaskOverdue::class, fn (TaskOverdue $n) => $n->task->is($late));
    expect($soon->fresh()->due_soon_notified_at)->not->toBeNull();

    // Tenggat diubah → pengingat boleh dikirim lagi.
    $soon->update(['due_date' => now()->addDays(5)->toDateString()]);
    expect($soon->fresh()->due_soon_notified_at)->toBeNull();
});

it('updates the email notification preference from the profile', function () {
    $this->actingAs($this->staff)->patch(route('profile.update'), [
        'name' => $this->staff->name,
        'email' => $this->staff->email,
        'notify_email' => false,
    ])->assertSessionHasNoErrors();

    expect($this->staff->fresh()->wantsEmailNotifications())->toBeFalse();

    // Tanpa field → tidak berubah.
    $this->actingAs($this->staff)->patch(route('profile.update'), [
        'name' => 'Staf Baru',
        'email' => $this->staff->email,
    ])->assertSessionHasNoErrors();

    expect($this->staff->fresh())->name->toBe('Staf Baru')
        ->and($this->staff->fresh()->wantsEmailNotifications())->toBeFalse();
});

it('schedules the reminder command daily at 07:00', function () {
    $this->artisan('schedule:list')->expectsOutputToContain('tasks:remind');
});
