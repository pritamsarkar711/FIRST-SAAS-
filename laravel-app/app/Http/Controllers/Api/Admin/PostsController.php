<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Services\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Port of src/app/api/admin/posts/route.ts (blog manager).
 * GET / POST / DELETE are 1:1. PATCH (declared by the routes/web.php
 * contract, not present in the original) saves with the same payload.
 * The slug is generated client-side by the blog manager (slugify) and only
 * validated server-side, exactly like the original.
 */
class PostsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $id = (string) $request->query('id', '');
        if ($id !== '') {
            $post = BlogPost::find($id);
            if (! $post) {
                return response()->json(['error' => 'Not found'], 404);
            }

            return response()->json(['post' => $post]);
        }

        $posts = BlogPost::orderByDesc('createdAt')
            ->get(['id', 'title', 'slug', 'status', 'views', 'publishedAt', 'createdAt']);

        return response()->json(['posts' => $posts]);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->save($request);
    }

    /** PATCH alias - same payload and behaviour as POST. */
    public function update(Request $request): JsonResponse
    {
        return $this->save($request);
    }

    private function save(Request $request): JsonResponse
    {
        /** @var \App\Models\User $admin */
        $admin = $request->user();

        $data = $request->json()->all();
        if (! is_array($data)) {
            return response()->json(['error' => 'Invalid post data.'], 400);
        }

        $validator = Validator::make($data, [
            'id' => ['nullable', 'string', 'min:1'],
            'title' => ['required', 'string', 'min:4', 'max:180'],
            'slug' => ['required', 'string', 'min:2', 'max:120', 'regex:/^[a-z0-9-]+$/'],
            'excerpt' => ['nullable', 'string', 'max:400'],
            'content' => ['required', 'string', 'min:10', 'max:200000'],
            'coverImage' => ['nullable', 'string', 'max:400'],
            'metaTitle' => ['nullable', 'string', 'max:70'],
            'metaDescription' => ['nullable', 'string', 'max:160'],
            'status' => ['required', 'in:DRAFT,PUBLISHED'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first() ?: 'Invalid post data.'], 400);
        }

        $d = $validator->validated();
        $payload = [
            'title' => $d['title'],
            'slug' => $d['slug'],
            'excerpt' => ($d['excerpt'] ?? '') !== '' ? $d['excerpt'] : null,
            'content' => $d['content'],
            'coverImage' => ($d['coverImage'] ?? '') !== '' ? $d['coverImage'] : null,
            'metaTitle' => ($d['metaTitle'] ?? '') !== '' ? $d['metaTitle'] : null,
            'metaDescription' => ($d['metaDescription'] ?? '') !== '' ? $d['metaDescription'] : null,
            'status' => $d['status'],
            'publishedAt' => $d['status'] === 'PUBLISHED' ? now() : null,
        ];

        if (! empty($d['id'])) {
            $existing = BlogPost::find($d['id']);
            if (! $existing) {
                return response()->json(['error' => 'Post not found.'], 404);
            }
            $payload['publishedAt'] = $existing->publishedAt ?? $payload['publishedAt'];
            $existing->fill($payload)->save();

            if ($d['status'] === 'PUBLISHED') {
                Activity::log([
                    'action' => 'BLOG_PUBLISH',
                    'actorEmail' => $admin->email,
                    'detail' => "Updated post: {$d['title']}",
                ]);
            }

            return response()->json(['ok' => true, 'id' => $d['id']]);
        }

        $post = BlogPost::create(array_merge($payload, ['authorId' => $admin->id]));

        if ($d['status'] === 'PUBLISHED') {
            Activity::log([
                'action' => 'BLOG_PUBLISH',
                'actorEmail' => $admin->email,
                'detail' => "Published post: {$d['title']}",
            ]);
        }

        return response()->json(['ok' => true, 'id' => $post->id]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $id = (string) $request->query('id', '');
        if ($id === '') {
            return response()->json(['error' => 'Post id required.'], 400);
        }

        BlogPost::whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }
}
