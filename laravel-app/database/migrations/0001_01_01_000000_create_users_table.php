<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('email')->unique();
            $table->string('passwordHash')->nullable();
            $table->string('name')->nullable();
            $table->string('image')->nullable();
            $table->string('role', 16)->default('USER'); // USER | ADMIN
            $table->string('status', 16)->default('ACTIVE'); // ACTIVE | SUSPENDED
            $table->unsignedInteger('credits')->default(10);
            $table->string('referralCode', 32)->unique();
            $table->ulid('referredById')->nullable();
            $table->string('twoFactorSecret')->nullable();
            $table->boolean('twoFactorEnabled')->default(false);
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();

            $table->foreign('referredById')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUlid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
    }
};
