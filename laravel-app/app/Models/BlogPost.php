<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlogPost extends Model
{
    use HasUlids;

    protected $table = 'blog_posts';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'title', 'slug', 'excerpt', 'content', 'coverImage', 'metaTitle',
        'metaDescription', 'status', 'views', 'authorId', 'publishedAt',
    ];

    protected $casts = ['views' => 'integer', 'publishedAt' => 'datetime'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorId');
    }
}
