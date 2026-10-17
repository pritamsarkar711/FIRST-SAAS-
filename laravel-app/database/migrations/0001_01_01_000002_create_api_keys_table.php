<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_keys', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->string('name', 120);
            $table->string('prefix', 32);
            $table->string('keyHash', 128)->unique();
            $table->timestamp('lastUsedAt', 3)->nullable();
            $table->unsignedInteger('requestCount')->default(0);
            $table->unsignedInteger('dailyCap')->nullable();
            $table->timestamp('revokedAt', 3)->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['userId', 'createdAt']);
        });

        Schema::create('api_key_usages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('keyId');
            $table->string('day', 10); // YYYY-MM-DD (UTC)
            $table->unsignedInteger('count')->default(0);

            $table->foreign('keyId')->references('id')->on('api_keys')->cascadeOnDelete();
            $table->unique(['keyId', 'day']);
            $table->index(['keyId', 'day']);
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId')->nullable();
            $table->string('actorEmail', 320);
            $table->string('action', 64);
            $table->text('detail')->nullable();
            $table->string('ip', 64)->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();

            $table->index('createdAt');
            $table->index(['action', 'createdAt']);
            $table->index(['actorEmail', 'createdAt']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->string('type', 32); // AUDIT | PAYMENT | WITHDRAWAL | MESSAGE | SYSTEM
            $table->string('title', 255);
            $table->text('body');
            $table->string('link', 255)->nullable();
            $table->boolean('read')->default(false);
            $table->timestamp('createdAt', 3)->useCurrent();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['userId', 'read', 'createdAt']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_key_usages');
        Schema::dropIfExists('api_keys');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('notifications');
    }
};
