// 博客接口封装：公开列表/详情、我的文章增删改、点赞。
import { apiRequest, jsonRequest } from "./apiRequest";
import type {
  BlogListResponse,
  BlogPostDetail,
  LikeResult,
  PostRecord,
  PostWritePayload,
} from "./types";

export function listPosts(offset = 0, limit = 10, sort = "published") {
  return apiRequest<BlogListResponse>(
    `/api/blog/posts?limit=${limit}&offset=${offset}&sort=${sort}`
  );
}

export function getPost(postId: number | string) {
  return apiRequest<BlogPostDetail>(`/api/blog/posts/${postId}`);
}

export function listMyPosts(offset = 0, limit = 50) {
  return apiRequest<BlogListResponse>(
    `/api/blog/me/posts?limit=${limit}&offset=${offset}`
  );
}

export function createPost(payload: PostWritePayload) {
  return apiRequest<PostRecord>(
    "/api/blog/posts",
    jsonRequest({ method: "POST", body: JSON.stringify(payload) })
  );
}

export function updatePost(postId: number | string, payload: PostWritePayload) {
  return apiRequest<PostRecord>(
    `/api/blog/posts/${postId}`,
    jsonRequest({ method: "PATCH", body: JSON.stringify(payload) })
  );
}

export function deletePost(postId: number | string) {
  return apiRequest<{ ok: boolean }>(`/api/blog/posts/${postId}`, {
    method: "DELETE",
  });
}

export function toggleLike(postId: number | string) {
  return apiRequest<LikeResult>(`/api/blog/posts/${postId}/like`, { method: "POST" });
}
