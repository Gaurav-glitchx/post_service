export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  mongodbUri: process.env.MONGODB_URI,
  kafkaBroker: process.env.KAFKA_BROKER,
  grpc: {
    authUrl: process.env.GRPC_AUTH_URL,
    userUrl: process.env.GRPC_USER_URL,
    mediaUrl: process.env.GRPC_MEDIA_URL,
    interactionUrl: process.env.GRPC_INTERACTION_URL,
  },
}); 