'use client';

import type {
  Comment,
  CommentTarget,
  FileSummary,
  Member,
  NotificationList,
  RequestDetail,
  RequestSummary,
  Signoff,
} from '@skillflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, call, errorMessage } from '@/lib/api/client';

export const collabKeys = {
  requests: (ws: string, agentId?: string) => ['requests', ws, agentId ?? 'all'] as const,
  request: (ws: string, id: string) => ['request', ws, id] as const,
  comments: (ws: string, type: CommentTarget, id: string) => ['comments', ws, type, id] as const,
  signoffs: (ws: string, skillId: string) => ['signoffs', ws, skillId] as const,
  members: (ws: string) => ['members', ws] as const,
  notifications: (ws: string) => ['notifications', ws] as const,
};

export function useRequests(workspaceId: string, agentId?: string) {
  return useQuery({
    queryKey: collabKeys.requests(workspaceId, agentId),
    queryFn: () =>
      call<RequestSummary[]>(
        api.GET('/api/w/{workspaceId}/requests', { params: { path: { workspaceId }, query: { agentId } } }),
      ),
  });
}

export function useRequest(workspaceId: string, requestId: string) {
  return useQuery({
    queryKey: collabKeys.request(workspaceId, requestId),
    queryFn: () =>
      call<RequestDetail>(
        api.GET('/api/w/{workspaceId}/requests/{requestId}', { params: { path: { workspaceId, requestId } } }),
      ),
    refetchOnWindowFocus: false,
  });
}

export function useComments(workspaceId: string, targetType: CommentTarget, targetId: string) {
  return useQuery({
    queryKey: collabKeys.comments(workspaceId, targetType, targetId),
    queryFn: () =>
      call<Comment[]>(
        api.GET('/api/w/{workspaceId}/comments', {
          params: { path: { workspaceId }, query: { targetType, targetId } },
        }),
      ),
  });
}

export function useSignoffs(workspaceId: string, skillId: string) {
  return useQuery({
    queryKey: collabKeys.signoffs(workspaceId, skillId),
    queryFn: () =>
      call<Signoff[]>(
        api.GET('/api/w/{workspaceId}/skills/{skillId}/signoffs', { params: { path: { workspaceId, skillId } } }),
      ),
  });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: collabKeys.members(workspaceId),
    queryFn: () =>
      call<Member[]>(api.GET('/api/w/{workspaceId}/members', { params: { path: { workspaceId } } })),
    staleTime: 60_000,
  });
}

export function useNotifications(workspaceId: string) {
  return useQuery({
    queryKey: collabKeys.notifications(workspaceId),
    queryFn: () =>
      call<NotificationList>(api.GET('/api/w/{workspaceId}/notifications', { params: { path: { workspaceId } } })),
    refetchInterval: 60_000,
  });
}

/** Uploads one file to a request. Multipart, so it goes through fetch directly. */
export async function uploadFile(
  workspaceId: string,
  requestId: string,
  file: File,
  requestInputId?: string,
): Promise<FileSummary> {
  const form = new FormData();
  form.append('file', file);
  if (requestInputId) form.append('requestInputId', requestInputId);
  const response = await fetch(`/api/w/${workspaceId}/requests/${requestId}/files`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      response.status === 413 ? 'Files can be up to 10 MB.' : errorMessage(body, 'The file could not be attached.');
    throw new ApiError(message, response.status);
  }
  return body as FileSummary;
}

export function fileUrl(workspaceId: string, fileId: string): string {
  return `/api/w/${workspaceId}/files/${fileId}`;
}
