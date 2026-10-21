<?php

use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ClientImportController;
use App\Http\Controllers\ClientPortalController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\Invoice\InvoiceController;
use App\Http\Controllers\Invoice\PaymentController;
use App\Http\Controllers\Invoice\WebhookController;
use App\Http\Controllers\InvoicePdfController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\PublicQuoteController;
use App\Http\Controllers\PwaController;
use App\Http\Controllers\QrisController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\SystemController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkSessionController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// PWA: manifest, service worker & halaman offline. Tanpa grup `web` (sesi,
// cookie, CSRF) — publik, tidak bergantung login.
Route::withoutMiddleware('web')->group(function () {
    Route::get('manifest.webmanifest', [PwaController::class, 'manifest'])->name('pwa.manifest');
    Route::get('sw.js', [PwaController::class, 'serviceWorker'])->name('pwa.sw');
    Route::get('offline', [PwaController::class, 'offline'])->name('pwa.offline');
});

// Wizard instalasi pertama (hanya aktif selama belum ada user sama sekali).
Route::get('setup', [SetupController::class, 'show'])->name('setup.show');
Route::post('setup', [SetupController::class, 'store'])->middleware('throttle:10,1')->name('setup.store');

// `visible`: staf hanya bisa membuka klien/proyek/invoice/penawaran/tugas dari
// proyek yang ia ikuti (App\Http\Middleware\EnsureResourceVisible).
Route::middleware(['auth', 'verified', 'visible'])->group(function () {
    Route::get('dashboard', [AdminDashboardController::class, 'index'])->name('dashboard');

    // Membuat / mengubah / menghapus / import klien khusus admin.
    Route::get('clients', [ClientController::class, 'index'])->name('clients.index');
    // Import klien dari CSV / Excel (harus sebelum clients/{client}).
    Route::get('clients/import/template', [ClientImportController::class, 'template'])->middleware('role:admin')->name('clients.import.template');
    Route::post('clients/import/preview', [ClientImportController::class, 'preview'])->middleware('role:admin')->name('clients.import.preview');
    Route::post('clients/import', [ClientImportController::class, 'store'])->middleware('role:admin')->name('clients.import.store');
    Route::get('clients/{client}', [ClientController::class, 'show'])->name('clients.show');
    Route::get('clients/{client}/export', [ClientController::class, 'export'])->middleware('role:admin')->name('clients.export');
    Route::post('clients', [ClientController::class, 'store'])->middleware('role:admin')->name('clients.store');
    Route::put('clients/{client}', [ClientController::class, 'update'])->middleware('role:admin')->name('clients.update');
    Route::delete('clients/{client}', [ClientController::class, 'destroy'])->middleware('role:admin')->name('clients.destroy');
    Route::post('clients/{client}/access-key', [ClientController::class, 'regenerateKey'])->middleware('role:admin')->name('clients.access-key');

    // Proyek & sub-proyek (Klien → Proyek → Sub-proyek). Staf boleh membuat /
    // mengubah sub-proyek di proyek yang ia ikuti (dicek di controller).
    Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->middleware('role:admin')->name('projects.destroy');
    Route::put('projects/{project}/members', [ProjectController::class, 'syncMembers'])->middleware('role:admin')->name('projects.members.sync');

    // Tugas. Baca detail lewat JSON (tasks.show) untuk panel samping; semua
    // penulisan memakai redirect back() + flash (Inertia).
    Route::get('tasks', [TaskController::class, 'index'])->name('tasks.index');
    Route::post('tasks', [TaskController::class, 'store'])->name('tasks.store');
    Route::get('tasks/{task}', [TaskController::class, 'show'])->name('tasks.show');
    Route::put('tasks/{task}', [TaskController::class, 'update'])->name('tasks.update');
    Route::delete('tasks/{task}', [TaskController::class, 'destroy'])->name('tasks.destroy');
    Route::patch('tasks/{task}/move', [TaskController::class, 'move'])->name('tasks.move');
    Route::post('tasks/{task}/start-timer', [TaskController::class, 'startTimer'])->name('tasks.start-timer');
    Route::post('tasks/{task}/checklist', [TaskController::class, 'storeChecklistItem'])->name('tasks.checklist.store');
    Route::put('task-checklist/{item}', [TaskController::class, 'updateChecklistItem'])->name('tasks.checklist.update');
    Route::delete('task-checklist/{item}', [TaskController::class, 'destroyChecklistItem'])->name('tasks.checklist.destroy');
    Route::post('tasks/{task}/comments', [TaskController::class, 'storeComment'])->name('tasks.comments.store');
    Route::delete('task-comments/{comment}', [TaskController::class, 'destroyComment'])->name('tasks.comments.destroy');

    // Notifikasi di aplikasi (lonceng).
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
    Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->name('notifications.read');

    Route::get('products', [ProductController::class, 'index'])->name('products.index');
    Route::post('products', [ProductController::class, 'store'])->name('products.store');
    Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
    Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');

    Route::prefix('invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('/export', [ReportController::class, 'exportInvoices'])->middleware('role:admin')->name('invoices.export');
        Route::get('/create', [InvoiceController::class, 'create'])->name('invoices.create');
        // Tugas selesai & belum ditagih untuk klien (JSON, harus sebelum /{invoice}).
        Route::get('/billable-tasks', [InvoiceController::class, 'billableTasks'])->name('invoices.billable-tasks');
        Route::post('/', [InvoiceController::class, 'store'])->name('invoices.store');
        Route::get('/{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::get('/{invoice}/edit', [InvoiceController::class, 'edit'])->name('invoices.edit');
        Route::put('/{invoice}', [InvoiceController::class, 'update'])->name('invoices.update');
        Route::delete('/{invoice}', [InvoiceController::class, 'destroy'])->name('invoices.destroy');
        Route::post('/{invoice}/send', [InvoiceController::class, 'send'])->name('invoices.send');
        Route::post('/{invoice}/resend', [InvoiceController::class, 'resend'])->name('invoices.resend');
        Route::post('/{invoice}/cancel', [InvoiceController::class, 'cancel'])->middleware('role:admin')->name('invoices.cancel');
        Route::post('/{invoice}/duplicate', [InvoiceController::class, 'duplicate'])->name('invoices.duplicate');
        Route::post('/{invoice}/recurrence/stop', [InvoiceController::class, 'stopRecurrence'])->name('invoices.recurrence.stop');
        Route::post('/{invoice}/payments', [InvoiceController::class, 'recordPayment'])->name('invoices.payments.store');
        Route::get('/{invoice}/pdf', [InvoicePdfController::class, 'download'])->name('invoices.pdf');
        Route::get('/{invoice}/pdf/stream', [InvoicePdfController::class, 'stream'])->name('invoices.pdf.stream');
    });

    // Penawaran harga (quotation) → bisa diubah menjadi invoice.
    Route::prefix('quotes')->group(function () {
        Route::get('/', [QuoteController::class, 'index'])->name('quotes.index');
        Route::get('/create', [QuoteController::class, 'create'])->name('quotes.create');
        Route::post('/', [QuoteController::class, 'store'])->name('quotes.store');
        Route::get('/{quote}', [QuoteController::class, 'show'])->name('quotes.show');
        Route::get('/{quote}/edit', [QuoteController::class, 'edit'])->name('quotes.edit');
        Route::put('/{quote}', [QuoteController::class, 'update'])->name('quotes.update');
        Route::delete('/{quote}', [QuoteController::class, 'destroy'])->name('quotes.destroy');
        Route::post('/{quote}/send', [QuoteController::class, 'send'])->name('quotes.send');
        Route::post('/{quote}/convert', [QuoteController::class, 'convert'])->name('quotes.convert');
        Route::post('/{quote}/duplicate', [QuoteController::class, 'duplicate'])->name('quotes.duplicate');
        Route::get('/{quote}/pdf', [QuoteController::class, 'pdf'])->name('quotes.pdf');
    });

    // Kuitansi pembayaran (PDF).
    Route::get('payments/{payment}/receipt', [ReceiptController::class, 'download'])->name('payments.receipt');

    // ---- Khusus pemilik & admin -------------------------------------------------
    Route::middleware('role:admin')->group(function () {
        Route::get('reports', [ReportController::class, 'index'])->name('reports.index');

        // Pengguna (akun staf & role).
        Route::get('settings/users', [UserController::class, 'index'])->name('users.index');
        Route::post('settings/users', [UserController::class, 'store'])->name('users.store');
        Route::put('settings/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('settings/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::post('settings/users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->name('users.password-reset');
        Route::post('settings/users/{user}/resend-invitation', [UserController::class, 'resendInvitation'])->name('users.resend-invitation');
        // Alihkan kepemilikan (hanya pemilik saat ini; dicek di controller).
        Route::post('settings/users/{user}/transfer-ownership', [UserController::class, 'transferOwnership'])->name('users.transfer-ownership');

        // Status sistem, uji kirim, backup.
        Route::get('settings/system', [SystemController::class, 'show'])->name('system.show');
        Route::post('settings/system/test-mail', [SystemController::class, 'testMail'])->middleware('throttle:5,1')->name('system.test-mail');
        Route::post('settings/system/test-whatsapp', [SystemController::class, 'testWhatsapp'])->middleware('throttle:5,1')->name('system.test-whatsapp');
        Route::get('settings/system/backup', [SystemController::class, 'backup'])->middleware('throttle:3,1')->name('system.backup');

        Route::get('settings/invoice', [SettingsController::class, 'edit'])->name('settings.invoice.edit');
        // QRIS: upload ke QRISLY, pilih QRIS aktif, pratinjau gaya.
        Route::post('settings/qris', [QrisController::class, 'store'])->name('qris.store');
        Route::post('settings/qris/preview', [QrisController::class, 'preview'])->name('qris.preview');
        Route::post('settings/qris/{qris}/activate', [QrisController::class, 'activate'])->name('qris.activate');
        Route::delete('settings/qris/{qris}', [QrisController::class, 'destroy'])->name('qris.destroy');

        Route::match(['get', 'post'], 'settings/invoice/pdf-preview', [SettingsController::class, 'previewPdf'])->name('settings.invoice.pdf-preview');
        Route::match(['post', 'put'], 'settings/invoice', [SettingsController::class, 'update'])->name('settings.invoice.update');
    });

    // Time Tracker (stopwatch per-client, sessions → invoice items)
    Route::get('time-tracker', [WorkSessionController::class, 'index'])->name('time-tracker.index');
    Route::post('work-sessions/start', [WorkSessionController::class, 'start'])->name('work-sessions.start');
    Route::post('work-sessions/{session}/pause', [WorkSessionController::class, 'pause'])->name('work-sessions.pause');
    Route::post('work-sessions/{session}/resume', [WorkSessionController::class, 'resume'])->name('work-sessions.resume');
    Route::post('work-sessions/{session}/stop', [WorkSessionController::class, 'stop'])->name('work-sessions.stop');
    Route::delete('work-sessions/{session}', [WorkSessionController::class, 'destroy'])->name('work-sessions.destroy');
});

// Public routes (no auth)
// Terima undangan tim: buat password lalu langsung masuk.
Route::middleware('guest')->group(function () {
    Route::get('/invitation/{token}', [InvitationController::class, 'show'])->name('invitation.accept');
    Route::post('/invitation', [InvitationController::class, 'store'])->middleware('throttle:10,1')->name('invitation.store');
});

Route::get('/pay/{token}', [PaymentController::class, 'show'])->name('pay.show');
Route::get('/pay/{token}/status', [PaymentController::class, 'status'])->name('pay.status');
Route::post('/pay/{token}/pay', [PaymentController::class, 'pay'])->name('pay.pay');
Route::post('/pay/{token}/simulate', [PaymentController::class, 'simulate'])->name('pay.simulate');

// Penawaran publik untuk klien (lihat, terima, tolak).
Route::get('/q/{token}', [PublicQuoteController::class, 'show'])->name('quote.public.show');
Route::post('/q/{token}/accept', [PublicQuoteController::class, 'accept'])->middleware('throttle:10,1')->name('quote.public.accept');
Route::post('/q/{token}/decline', [PublicQuoteController::class, 'decline'])->middleware('throttle:10,1')->name('quote.public.decline');

// Kuitansi untuk klien dari halaman bayar.
Route::get('/pay/{token}/receipts/{payment}', [ReceiptController::class, 'public'])->name('pay.receipt');

// Portal klien publik: masuk lewat kunci akses dari halaman Clients.
Route::get('/client-portal', [ClientPortalController::class, 'show'])->name('client.portal');
Route::post('/client-portal', [ClientPortalController::class, 'verify'])->middleware('throttle:10,1')->name('client.portal.verify');
Route::post('/client-portal/logout', [ClientPortalController::class, 'logout'])->name('client.portal.logout');

// Webhook (no auth + signature verified).
Route::post('/webhook/qrisly', [WebhookController::class, 'handle'])->middleware('throttle:60,1')->name('webhook.qrisly');

require __DIR__.'/settings.php';
