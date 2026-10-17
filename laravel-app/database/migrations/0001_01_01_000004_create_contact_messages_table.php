<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId')->nullable();
            $table->string('name', 120);
            $table->string('email', 190);
            $table->string('reason', 80);
            $table->mediumText('message');
            $table->string('status', 16)->default('OPEN'); // OPEN | REPLIED | CLOSED
            $table->text('reply')->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('repliedAt', 3)->nullable();

            $table->foreign('userId')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('blog_posts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->text('excerpt')->nullable();
            $table->mediumText('content');
            $table->string('coverImage', 255)->nullable();
            $table->string('metaTitle', 255)->nullable();
            $table->string('metaDescription', 500)->nullable();
            $table->string('status', 16)->default('DRAFT'); // DRAFT | PUBLISHED
            $table->unsignedInteger('views')->default(0);
            $table->ulid('authorId');
            $table->timestamp('publishedAt', 3)->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('updatedAt', 3)->nullable()->useCurrentOnUpdate();

            $table->foreign('authorId')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('affiliate_earnings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->ulid('fromUserId')->nullable();
            $table->ulid('paymentId')->nullable();
            $table->float('amount');
            $table->string('status', 16)->default('PENDING'); // PENDING | CLEARED | PAID
            $table->timestamp('createdAt', 3)->useCurrent();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('fromUserId')->references('id')->on('users')->nullOnDelete();
            $table->foreign('paymentId')->references('id')->on('payments')->nullOnDelete();
        });

        Schema::create('withdrawals', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('userId');
            $table->float('amount');
            $table->string('method', 32);
            $table->string('account', 120);
            $table->string('status', 16)->default('PENDING'); // PENDING | PROCESSING | COMPLETED | REJECTED
            $table->text('note')->nullable();
            $table->timestamp('createdAt', 3)->useCurrent();
            $table->timestamp('reviewedAt', 3)->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
        Schema::dropIfExists('blog_posts');
        Schema::dropIfExists('affiliate_earnings');
        Schema::dropIfExists('withdrawals');
    }
};
