<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => fn () => Project::create([
                'client_id' => Client::create(['name' => fake()->company()])->id,
                'name' => fake()->unique()->words(2, true),
            ])->id,
            'title' => fake()->sentence(4),
            'description' => null,
            'status' => 'todo',
            'priority' => 'normal',
            'billable' => true,
            'position' => 0,
        ];
    }

    public function done(): static
    {
        return $this->state(fn () => ['status' => 'done']);
    }
}
