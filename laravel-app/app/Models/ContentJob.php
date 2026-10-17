<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentJob extends Model
{
    use HasUlids;

    protected $table = 'content_jobs';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId', 'type', 'mode', 'keyword', 'input', 'status', 'result',
        'images', 'error', 'creditsUsed',
    ];

    protected $casts = ['creditsUsed' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
