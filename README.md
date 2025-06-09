# Post Service

A NestJS microservice for handling posts in a social media platform. This service is responsible for managing posts, including creation, updates, deletion, and feed generation.

## Features

- CRUD operations for posts
- Feed generation based on user relationships
- Media integration with S3
- User validation
- Interaction integration (likes, comments)
- Notification broadcasting
- Admin moderation capabilities
- Comprehensive logging
- gRPC communication
- Kafka event streaming

## Tech Stack

- TypeScript
- NestJS
- MongoDB (Mongoose)
- gRPC
- Kafka
- JWT Authentication
- Swagger Documentation
- Docker

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- MongoDB
- Kafka
- gRPC services (Auth, User, Media, Interaction)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd post-service
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
NODE_ENV=development
PORT=3000
GRPC_PORT=50055
MONGODB_URI=mongodb://localhost:27017/post-service
KAFKA_BROKERS=localhost:9092
AUTH_SERVICE_URL=grpc://localhost:50051
USER_SERVICE_URL=grpc://localhost:50052
MEDIA_SERVICE_URL=grpc://localhost:50053
INTERACTION_SERVICE_URL=grpc://localhost:50054
```

## Development

1. Start the development environment:
```bash
docker-compose up -d
```

2. Start the service in development mode:
```bash
npm run start:dev
```

## API Documentation

Once the service is running, you can access the Swagger documentation at:
```
http://localhost:3000/api
```

## gRPC Endpoints

The service exposes the following gRPC endpoints:

- `CreatePost`: Create a new post
- `GetPost`: Retrieve a post by ID
- `UpdatePost`: Update an existing post
- `DeletePost`: Delete a post
- `GetPostsByUser`: Get all posts by a user
- `GetFeed`: Get the user's feed
- `RemovePost`: Admin endpoint to remove a post

## Kafka Events

The service produces the following Kafka events:

- `post.created`: When a new post is created
- `post.updated`: When a post is updated
- `post.deleted`: When a post is deleted
- `post.moderated`: When a post is moderated by an admin

## Logging

The service uses a custom logger that writes logs to both console and file. Logs are stored in the `logs` directory and include:

- Request/response logging
- gRPC call logging
- Error logging
- Performance metrics

## Testing

Run the test suite:
```bash
npm run test
```

Run e2e tests:
```bash
npm run test:e2e
```

## Docker

Build the Docker image:
```bash
docker build -t post-service .
```

Run the container:
```bash
docker run -p 3000:3000 -p 50055:50055 post-service
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 