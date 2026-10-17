<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_jobs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->string('type', 16); // ADSENSE | AFFILIATE
            $table->string('mode', 16); // STANDARD | PREMIUM
            $table->string('keyword', 255);
            $table->text('input')->nullable(); // JSON options
            $table->string('status', 16)->default('PENDING'); // PENDING | RUNNING | DONE | FAILED
            $table->mediumText('result')->nullable(); // JSON article
            $table->mediumText('images')->nullable(); // JSON image files
            $table->text('error')->nullable();
            $table->unsignedInteger('creditsUsed')->default(0);
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['userId', 'createdAt']);
        });

        Schema::create('index_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->mediumText('urls'); // JSON string[]
            $table->string('keyFileUrl', 255)->nullable();
            $table->string('status', 16)->default('PENDING'); // PENDING | SUBMITTED | PARTIAL | FAILED
            $table->mediumText('result')->nullable(); // JSON
            $table->unsignedInteger('creditsUsed')->default(0);
            $table->timestamp('createdAt', 3)->useCurrent();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 64)->primary();
            $table->mediumText('value'); // JSON
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_jobs');
        Schema::dropIfExists('index_requests');
        Schema::dropIfExists('settings');
    }
};
