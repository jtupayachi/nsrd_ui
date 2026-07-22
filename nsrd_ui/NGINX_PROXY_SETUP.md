# nginx-proxy Integration Setup

This Docker Compose configuration is designed to work with `nginxproxy/nginx-proxy` and `nginxproxy/acme-companion` for automatic SSL certificate management.

## Changes Made

### 1. Port Exposure
- Changed from `ports` to `expose` directive
- Containers now expose ports internally to the nginx-proxy network only
- No direct external port mapping (8432:80) needed

### 2. Environment Variables Added

#### For nginx-proxy:
- `VIRTUAL_HOST`: The domain name that nginx-proxy should route to this container
- `VIRTUAL_PORT`: The internal port the container listens on

#### For acme-companion (Let's Encrypt):
- `LETSENCRYPT_HOST`: The domain for SSL certificate generation
- `LETSENCRYPT_EMAIL`: Email for Let's Encrypt notifications

### 3. Network Configuration
- Changed to use the external `nginx-proxy` network
- This connects your container to the nginx-proxy ecosystem

## Deployment Steps

### 1. Ensure nginx-proxy Network Exists
```bash
docker network ls | grep nginx-proxy
```

If it doesn't exist, create it:
```bash
docker network create nginx-proxy
```

### 2. Stop and Remove Old Container
```bash
docker-compose down
# Or if already running:
docker stop nsrd-ui && docker rm nsrd-ui
```

### 3. Update Email Address
Edit `docker-compose.yml` and replace `admin@recoil.ise.utk.edu` with your actual email address.

### 4. Start the New Configuration
```bash
# Production mode
docker-compose up -d

# Development mode (with hot reload)
docker-compose --profile dev up -d
```

### 5. Verify Setup
```bash
# Check container is running
docker ps | grep nsrd-ui

# Check it's on the right network
docker inspect nsrd-ui | grep -A 10 Networks

# Check nginx-proxy logs for routing
docker logs nginx-proxy | grep demo2.recoil.ise.utk.edu

# Check acme-companion logs for SSL
docker logs nginx-proxy-acme | grep demo2.recoil.ise.utk.edu
```

## Current nginx-proxy Configuration

Based on your nginx configuration, the following services are now managed by nginx-proxy:

- **demo2.recoil.ise.utk.edu** → nsrd-ui (port 8432) - ORNL GIS App
- **demo3.recoil.ise.utk.edu** → clinic-sense (port 6700) - Clinicsense App
- **m1.recoil.ise.utk.edu** → frontend (port 7835)
- **m2.recoil.ise.utk.edu** → backend (port 7832)

## How It Works

1. **nginx-proxy** automatically detects containers with `VIRTUAL_HOST` environment variables
2. It generates nginx configuration to route traffic based on the hostname
3. **acme-companion** monitors for `LETSENCRYPT_HOST` variables
4. It automatically requests and renews Let's Encrypt SSL certificates
5. All SSL configuration is handled automatically

## Benefits

- ✅ Automatic SSL certificate generation and renewal
- ✅ No manual nginx configuration needed
- ✅ Easy to add new services (just add environment variables)
- ✅ Zero-downtime certificate renewals
- ✅ Centralized reverse proxy management

## Troubleshooting

### Container not accessible via domain
```bash
# Check if nginx-proxy sees the container
docker logs nginx-proxy | tail -n 50

# Verify environment variables
docker inspect nsrd-ui | grep -A 5 VIRTUAL
```

### SSL certificate issues
```bash
# Check acme-companion logs
docker logs nginx-proxy-acme | tail -n 100

# Verify Let's Encrypt rate limits haven't been hit
# (5 certificates per week per domain)
```

### Network connectivity issues
```bash
# Ensure container is on nginx-proxy network
docker network inspect nginx-proxy

# Should show nsrd-ui container in the list
```

## Development Mode

For development with hot reload, use the `dev` profile:

```bash
docker-compose --profile dev up -d
```

This starts `nsrd-ui-dev` instead, which:
- Uses `Dockerfile.dev` for hot reload
- Exposes on `demo2-dev.recoil.ise.utk.edu` (if configured in DNS)
- Mounts source code for live changes

## Migration Notes

If you were previously accessing the service directly via port 8432, traffic will now go through nginx-proxy:
- **Old**: http://server-ip:8432
- **New**: https://demo2.recoil.ise.utk.edu

The nginx-proxy setup provides proper SSL termination and domain routing.
