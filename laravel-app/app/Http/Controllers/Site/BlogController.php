<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BlogController extends Controller
{
    public function index(): Response
    {
        $posts = BlogPost::where('status', 'PUBLISHED')
            ->orderByDesc('publishedAt')
            ->get(['id', 'title', 'slug', 'excerpt', 'coverImage', 'publishedAt', 'views']);

        return Inertia::render('Site/Blog/Index', ['posts' => $posts]);
    }

    public function show(Request $request, string $slug): Response
    {
        $post = BlogPost::where('slug', $slug)->where('status', 'PUBLISHED')->first();

        if (! $post) {
            abort(404);
        }
        $post->increment('views');

        $related = BlogPost::where('status', 'PUBLISHED')
            ->where('id', '!=', $post->id)
            ->orderByDesc('publishedAt')
            ->limit(3)
            ->get(['id', 'title', 'slug', 'excerpt', 'publishedAt']);

        return Inertia::render('Site/Blog/Show', ['post' => $post, 'related' => $related]);
    }
}
