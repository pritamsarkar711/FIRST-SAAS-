<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $table = 'settings';
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;

    const CREATED_AT = null;
    const UPDATED_AT = 'updatedAt';

    protected $fillable = ['key', 'value'];
}
