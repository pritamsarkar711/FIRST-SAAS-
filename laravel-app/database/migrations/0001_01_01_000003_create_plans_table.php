<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 80);
            $table->string('slug', 80)->unique();
            $table->string('description', 255)->nullable();
            $table->float('priceUsd');
            $table->unsignedInteger('credits');
            $table->unsignedInteger('monitorLimit')->nullable();
            $table->text('features')->default('[]'); // JSON string[]
            $table->string('badge', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sortOrder')->default(0);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->ulid('planId')->nullable();
            $table->string('planName', 80);
            $table->unsignedInteger('credits');
            $table->string('status', 16)->default('ACTIVE'); // ACTIVE | CANCELLED | EXPIRED
            $table->timestamp('startedAt', 3)->useCurrent();
            $table->timestamp('expiresAt', 3)->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->ulid('planId')->nullable();
            $table->string('planName', 80);
            $table->float('amount');
            $table->string('currency', 8)->default('USD');
            $table->float('amountBdt')->nullable();
            $table->string('gateway', 32);
            $table->text('senderInfo')->nullable();
            $table->string('txId', 120)->nullable();
            $table->string('status', 16)->default('PENDING'); // PENDING | APPROVED | REJECTED
            $table->text('note')->nullable();
            $table->text('meta')->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('reviewedAt', 3)->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('planId')->references('id')->on('plans')->nullOnDelete();
            $table->index(['status', 'createdAt']);
        });

        Schema::create('gateway_configs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('name', 80);
            $table->string('logo', 255)->nullable();
            $table->boolean('enabled')->default(false);
            $table->string('mode', 16)->default('MANUAL'); // MANUAL | API
            $table->text('instructions')->nullable();
            $table->text('config')->default('{}'); // JSON provider keys
            $table->unsignedInteger('sortOrder')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('gateway_configs');
    }
};
