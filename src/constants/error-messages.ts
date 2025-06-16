export const ErrorMessages = {
  // Post related errors
  POST_NOT_FOUND: "Post not found",
  POST_NOT_AVAILABLE: "Post not found or unavailable",
  POST_ALREADY_SAVED: "Post already saved",
  POST_SAVE_SUCCESS: "Post saved successfully",
  POST_UNSAVE_SUCCESS: "Post unsaved successfully",
  POST_DELETE_SUCCESS: "Post deleted successfully",
  POST_UPDATE_SUCCESS: "Post updated successfully",
  POST_CREATE_SUCCESS: "Post created successfully",
  POST_REPORT_SUCCESS: "Post reported successfully",
  POST_UNREPORT_SUCCESS: "Post unreported successfully",
  POST_MODERATE_SUCCESS: "Post moderated successfully",
  POST_UNMODERATE_SUCCESS: "Post unmoderated successfully",

  // User related errors
  USER_NOT_FOUND: "User not found",
  USER_NOT_AUTHORIZED: "User not authorized to perform this action",
  USER_ALREADY_REPORTED: "User has already reported this post",
  USER_NOT_REPORTED: "User has not reported this post",

  // Media related errors
  MEDIA_UPLOAD_FAILED: "Failed to upload media",
  MEDIA_DELETE_FAILED: "Failed to delete media",
  MEDIA_NOT_FOUND: "Media not found",
  INVALID_MEDIA_TYPE: "Invalid media type",
  MEDIA_SIZE_EXCEEDED: "Media size exceeded",

  // Validation errors
  INVALID_POST_ID: "Invalid post ID format",
  INVALID_USER_ID: "Invalid user ID format",
  INVALID_MEDIA_URL: "Invalid media URL",
  INVALID_VISIBILITY: "Invalid visibility setting",
  INVALID_REPORT_REASON: "Invalid report reason",
  INVALID_MODERATION_REASON: "Invalid moderation reason",

  // Permission errors
  NOT_POST_OWNER: "You are not the owner of this post",
  NOT_MODERATOR: "You are not authorized to moderate posts",
  NOT_ADMIN: "You are not authorized to perform admin actions",

  // System errors
  INTERNAL_SERVER_ERROR: "Internal server error",
  DATABASE_ERROR: "Database operation failed",
  GRPC_ERROR: "gRPC service error",
  FILE_SYSTEM_ERROR: "File system operation failed",
} as const;

export const SuccessMessages = {
  // Post related success messages
  POST_SAVED: "Post saved successfully",
  POST_UNSAVED: "Post unsaved successfully",
  POST_DELETED: "Post deleted successfully",
  POST_UPDATED: "Post updated successfully",
  POST_CREATED: "Post created successfully",
  POST_REPORTED: "Post reported successfully",
  POST_UNREPORTED: "Post unreported successfully",
  POST_MODERATED: "Post moderated successfully",
  POST_UNMODERATED: "Post unmoderated successfully",

  // Media related success messages
  MEDIA_UPLOADED: "Media uploaded successfully",
  MEDIA_DELETED: "Media deleted successfully",

  // General success messages
  OPERATION_SUCCESS: "Operation completed successfully",
} as const;
