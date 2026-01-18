// ============================================
// Session Types
// ============================================

export type SessionStatus = 'running' | 'waiting' | 'completed';

export interface Session {
  id: string;
  cwd: string;
  status: SessionStatus;
  createdAt: string;
}

// ============================================
// REST API Types
// ============================================

// GET /api/sessions
export interface GetSessionsResponse {
  sessions: Session[];
}

// GET /api/sessions/:id
export interface GetSessionResponse {
  session: Session;
}

// POST /api/sessions
export interface CreateSessionRequest {
  cwd: string;
}

export interface CreateSessionResponse {
  session: Session;
}

// PATCH /api/sessions/:id
export interface UpdateSessionRequest {
  status?: SessionStatus;
}

export interface UpdateSessionResponse {
  session: Session;
}

// DELETE /api/sessions/:id
export interface DeleteSessionResponse {
  success: boolean;
}

// Error Response
export interface ApiErrorResponse {
  error: string;
  message: string;
}

// ============================================
// WebSocket Message Types
// ============================================

export type NotificationType = 'waiting' | 'completed';

// Client -> Server Messages
export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage;

export interface SubscribeMessage {
  type: 'subscribe';
  sessionId?: string; // Subscribe to specific session, or all if omitted
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  sessionId?: string;
}

// Server -> Client Messages
export type ServerMessage =
  | SessionCreatedMessage
  | SessionUpdatedMessage
  | SessionDeletedMessage
  | NotificationMessage
  | ErrorMessage;

export interface SessionCreatedMessage {
  type: 'session:created';
  session: Session;
}

export interface SessionUpdatedMessage {
  type: 'session:updated';
  session: Session;
}

export interface SessionDeletedMessage {
  type: 'session:deleted';
  sessionId: string;
}

export interface NotificationMessage {
  type: 'notification';
  notificationType: NotificationType;
  session: Session;
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}
