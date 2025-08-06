#!/usr/bin/env node

/**
 * OCI MCP Server 테스트 스크립트
 * 서버가 정상적으로 시작되고 MCP 프로토콜을 처리하는지 확인
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 OCI MCP Server 테스트 시작...\n');

// 서버 실행
const serverPath = join(__dirname, 'dist', 'simple-index.js');
console.log(`📍 서버 경로: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // 테스트용 더미 환경변수 (실제 OCI 계정 없이도 서버 시작 테스트 가능)
    OCI_TENANCY_ID: 'test-tenancy-id',
    OCI_USER_ID: 'test-user-id',
    OCI_KEY_FINGERPRINT: 'test:fingerprint',
    OCI_PRIVATE_KEY_PATH: '/tmp/test-key.pem',
    OCI_REGION: 'us-ashburn-1'
  }
});

console.log('🚀 MCP 서버 시작 중...');

// 서버 출력 모니터링
server.stdout.on('data', (data) => {
  console.log('📤 서버 출력:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('⚠️  서버 에러:', data.toString().trim());
});

server.on('close', (code) => {
  console.log(`\n🔚 서버 종료 (코드: ${code})`);
});

// 5초 후 테스트 메시지 전송
setTimeout(() => {
  console.log('\n📨 MCP 초기화 요청 전송...');
  
  // MCP 초기화 메시지
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };

  server.stdin.write(JSON.stringify(initMessage) + '\n');
  
  // 3초 후 도구 목록 요청
  setTimeout(() => {
    console.log('📨 도구 목록 요청 전송...');
    
    const toolsMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };
    
    server.stdin.write(JSON.stringify(toolsMessage) + '\n');
    
    // 2초 후 서버 종료
    setTimeout(() => {
      console.log('\n✅ 테스트 완료! 서버 종료 중...');
      server.kill();
    }, 2000);
  }, 3000);
}, 5000);

// Ctrl+C 처리
process.on('SIGINT', () => {
  console.log('\n🛑 테스트 중단됨');
  server.kill();
  process.exit(0);
});
