# Oracle Cloud Free Tier를 활용한 Cader Server 호스팅 가이드

## 🆓 Oracle Cloud Free Tier 리소스

### Always Free Resources
- **Compute**: VM.Standard.E2.1.Micro (1 OCPU, 1GB RAM) × 2개
- **Block Storage**: 200GB (부팅 볼륨 2개 + 블록 볼륨)
- **Object Storage**: 10GB
- **Load Balancer**: 1개 (10Mbps)
- **VCN**: Virtual Cloud Network
- **Autonomous Database**: 20GB (2개)

### 30일 $300 크레딧
- 더 큰 인스턴스 테스트 가능
- 추가 서비스 실험

## 🏗️ 호스팅 아키텍처

### Option 1: 단일 VM 구성 (추천)
```
Oracle Cloud VM (Always Free)
├── Cader Rails App (Puma Server)
├── PostgreSQL Database
├── Redis (세션/캐시)
└── Nginx (Reverse Proxy)
```

### Option 2: 분산 구성 (고급)
```
Load Balancer (Always Free)
├── VM 1: Rails App Server
├── VM 2: Database Server
└── Autonomous Database (Always Free)
```

## 📋 구현 단계

### Phase 1: OCI 인프라 설정 (OCI MCP 사용)
1. ✅ Compute 인스턴스 생성
2. ✅ VCN 및 서브넷 구성
3. ✅ 보안 그룹 설정
4. ✅ 도메인 및 SSL 설정

### Phase 2: Coolify 설치 및 구성
1. ✅ Docker 및 Coolify 설치
2. ✅ Git 연동 설정
3. ✅ 데이터베이스 구성
4. ✅ 환경 변수 설정

### Phase 3: Cader Server 배포
1. ✅ Rails 애플리케이션 배포
2. ✅ 데이터베이스 마이그레이션
3. ✅ Asset 파이프라인 구성
4. ✅ SSL 및 도메인 연결

## 🛠️ 구체적인 구현 명령어

### 1. OCI MCP로 인프라 생성
```json
// 1. Compute 인스턴스 생성
{
  "service": "compute",
  "action": "create",
  "resourceType": "instance",
  "parameters": {
    "availabilityDomain": "AD-1",
    "compartmentId": "your-compartment-id",
    "shape": "VM.Standard.E2.1.Micro",
    "imageId": "ubuntu-22.04-minimal",
    "displayName": "cader-server-host"
  }
}

// 2. VCN 네트워크 구성
{
  "service": "network",
  "action": "create", 
  "resourceType": "vcn",
  "parameters": {
    "cidrBlock": "10.0.0.0/16",
    "displayName": "cader-vcn"
  }
}

// 3. 보안 그룹 설정 (HTTP/HTTPS/SSH)
{
  "service": "network",
  "action": "update",
  "resourceType": "security-lists",
  "parameters": {
    "ingressRules": [
      {"protocol": "TCP", "port": 22, "source": "0.0.0.0/0"},
      {"protocol": "TCP", "port": 80, "source": "0.0.0.0/0"},
      {"protocol": "TCP", "port": 443, "source": "0.0.0.0/0"}
    ]
  }
}
```

### 2. 서버 초기 설정 스크립트
```bash
#!/bin/bash
# OCI VM 초기 설정

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Coolify 설치
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Nginx 설치 (리버스 프록시용)
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# PostgreSQL 클라이언트 (Autonomous DB 연결용)
sudo apt install postgresql-client -y
```

### 3. Coolify로 Cader Server 배포 설정
```yaml
# docker-compose.yml for Cader Server
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - RAILS_ENV=production
      - DATABASE_URL=postgresql://user:pass@host:port/db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app

volumes:
  redis_data:
```

## 💡 실행 계획
