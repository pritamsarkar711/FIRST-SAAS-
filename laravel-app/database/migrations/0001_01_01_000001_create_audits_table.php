<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audits', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->string('domain', 255);
            $table->string('target', 16)->default('ADSENSE'); // ADSENSE | EZOIC | MEDIAVINE | RAPTIVE
            $table->string('mode', 16); // NORMAL | STANDARD | PREMIUM
            $table->string('status', 16)->default('PENDING'); // PENDING | RUNNING | DONE | FAILED
            $table->unsignedInteger('probability')->default(0);
            $table->string('verdict', 64)->nullable();
            $table->mediumText('report')->nullable(); // JSON report
            $table->text('signals')->nullable(); // JSON crawl signals
            $table->boolean('deepScan')->default(false);
            $table->text('error')->nullable();
            $table->unsignedInteger('creditsUsed')->default(0);
            $table->string('shareToken', 64)->nullable()->unique();
            $table->string('batchId', 64)->nullable();
            $table->ulid('watchItemId')->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('watchItemId')->references('id')->on('watch_items')->nullOnDelete();
            $table->index(['userId', 'createdAt']);
            $table->index(['domain', 'createdAt']);
            $table->index('batchId');
        });

        Schema::create('watch_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->string('domain', 255);
            $table->string('target', 16)->default('ADSENSE');
            $table->string('mode', 16)->default('STANDARD');
            $table->boolean('deepScan')->default(false);
            $table->unsignedInteger('intervalDays')->default(7);
            $table->boolean('active')->default(true);
            $table->ulid('lastAuditId')->nullable();
            $table->unsignedInteger('lastScore')->nullable();
            $table->timestamp('lastRunAt', 3)->nullable();
            $table->timestamp('nextRunAt', 3)->nullable();
            $table->unsignedInteger('runs')->default(0);
            $table->string('pausedReason', 255)->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['userId', 'domain', 'target']);
            $table->index(['active', 'nextRunAt']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audits');
        Schema::dropIfExists('watch_items');
    }
};
