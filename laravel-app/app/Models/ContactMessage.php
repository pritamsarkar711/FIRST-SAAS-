<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactMessage extends Model
{
    use HasUlids;

    protected $table = 'contact_messages';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $fillable = ['userId', 'name', 'email', 'reason', 'message', 'status', 'reply', 'repliedAt'];

    protected $casts = ['repliedAt' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
