#!/usr/bin/env node

/**
 * OCI MCP 서버 기능 테스트
 * 실제 OCI 도구 호출을 시뮬레이션
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 OCI MCP 도구 기능 테스트\n');

// 서버 실행
const serverPath = join(__dirname, 'dist', 'simple-index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // 테스트용 환경변수
    OCI_TENANCY_ID: 'ocid1.tenancy.oc1..test',
    OCI_USER_ID: 'ocid1.user.oc1..test',
    OCI_KEY_FINGERPRINT: 'aa:bb:cc:dd:ee:ff:gg:hh:ii:jj:kk:ll:mm:nn:oo:pp',
    OCI_PRIVATE_KEY_PATH: '/tmp/test-key.pem',
    OCI_REGION: 'us-ashburn-1'
  }
});

let messageId = 1;

// 서버 출력 모니터링
server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString().trim());
    console.log('📤 서버 응답:', JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('📤 서버 출력:', data.toString().trim());
  }
});

server.stderr.on('data', (data) => {
  console.log('⚠️  서버 에러:', data.toString().trim());
});

// MCP 메시지 전송 함수
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: "2.0",
    id: messageId++,
    method: method,
    params: params
  };
  
  console.log(`\n📨 요청 전송: ${method}`);
  console.log(JSON.stringify(message, null, 2));
  
  server.stdin.write(JSON.stringify(message) + '\n');
}

// 테스트 시퀀스
setTimeout(() => {
  console.log('🚀 MCP 프로토콜 테스트 시작...\n');
  
  // 1. 초기화
  sendMessage("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    clientInfo: { name: "oci-test-client", version: "1.0.0" }
  });
  
  setTimeout(() => {
    // 2. 도구 목록 요청
    sendMessage("tools/list");
    
    setTimeout(() => {
      // 3. OCI 도구 호출 (compute 인스턴스 목록)
      sendMessage("tools/call", {
        name: "oci-manage",
        arguments: {
          service: "compute",
          action: "list",
          resourceType: "instances",
          compartmentId: "ocid1.compartment.oc1..test"
        }
      });
      
      setTimeout(() => {
        // 4. OCI 도구 호출 (storage 버킷 목록)
        sendMessage("tools/call", {
          name: "oci-manage",
          arguments: {
            service: "storage",
            action: "list",
            resourceType: "buckets",
            compartmentId: "ocid1.compartment.oc1..test"
          }
        });
        
        setTimeout(() => {
          console.log('\n✅ 테스트 완료!');
          server.kill();
        }, 3000);
      }, 3000);
    }, 3000);
  }, 3000);
}, 2000);

// Ctrl+C 처리
process.on('SIGINT', () => {
  console.log('\n🛑 테스트 중단됨');
  server.kill();
  process.exit(0);
});
