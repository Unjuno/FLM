// certificate-generator - 証明書自動生成モジュール

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import forge from 'node-forge';

const execAsync = promisify(exec);

/**
 * データディレクトリのパスを取得
 */
function getDataDir(): string {
  return (
    process.env.FLM_DATA_DIR ||
    (process.platform === 'win32'
      ? path.join(
          process.env.LOCALAPPDATA ||
            path.join(os.homedir(), 'AppData', 'Local'),
          'FLM'
        )
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'FLM')
        : path.join(os.homedir(), '.local', 'share', 'FLM'))
  );
}

/**
 * 証明書ディレクトリのパスを取得
 */
function getCertDir(): string {
  return path.join(getDataDir(), 'certificates');
}

/**
 * 証明書ファイルのパスを取得
 */
function getCertPath(apiId: string): string {
  return path.join(getCertDir(), `${apiId}.pem`);
}

/**
 * 秘密鍵ファイルのパスを取得
 */
function getKeyPath(apiId: string): string {
  return path.join(getCertDir(), `${apiId}.key`);
}

/**
 * OpenSSLを使用して自己署名証明書を生成
 * 大衆向け: ユーザー操作不要で自動生成
 */
async function generateCertificateWithOpenSSL(
  apiId: string,
  port: number,
  localIp?: string
): Promise<{ certPath: string; keyPath: string }> {
  const certDir = getCertDir();
  const certPath = getCertPath(apiId);
  const keyPath = getKeyPath(apiId);

  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  // Subject Alternative Name (SAN) のホスト名リストを作成
  // DNS名としてlocalhostを追加（ポート番号は含めない）
  const dnsNames: string[] = ['localhost'];
  // IPアドレスとして127.0.0.1を追加
  const ipAddresses: string[] = ['127.0.0.1'];

  // ローカルIPアドレスが指定されている場合は追加
  if (localIp) {
    ipAddresses.push(localIp);
  }

  // OpenSSLコマンドを構築
  // openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes -subj "/CN=FLM API Server" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  const subject = '/CN=FLM API Server/O=FLM/C=JP';
  const sanParts: string[] = [
    ...dnsNames.map(name => `DNS:${name}`),
    ...ipAddresses.map(ip => `IP:${ip}`),
  ];
  const sanExtension = `subjectAltName=${sanParts.join(',')}`;

  try {
    // 秘密鍵と証明書を一度に生成
    const opensslCmd = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "${subject}" -addext "${sanExtension}"`;

    await execAsync(opensslCmd);

    // ファイルが生成されたか確認（ファイルシステムの反映を待つ）
    let retries = 10;
    while (
      retries > 0 &&
      (!fs.existsSync(certPath) || !fs.existsSync(keyPath))
    ) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error('証明書ファイルの生成に失敗しました');
    }

    return { certPath, keyPath };
  } catch (error) {
    // OpenSSLが利用できない場合、Node.jsで生成を試みる
    console.warn('OpenSSLが見つかりません。Node.jsで証明書を生成します...');
    return await generateCertificateWithNodeForge(apiId, port, localIp);
  }
}

/**
 * node-forgeを使用して自己署名証明書を生成（フォールバック）
 * 注意: node-forgeはインストールされていない場合があります。OpenSSLを優先します。
 */
async function generateCertificateWithNodeForge(
  apiId: string,
  _port: number,
  localIp?: string
): Promise<{ certPath: string; keyPath: string }> {
  const certDir = getCertDir();
  const certPath = getCertPath(apiId);
  const keyPath = getKeyPath(apiId);

  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  try {
    // 秘密鍵を生成（RSA 2048ビット）
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKey = keys.privateKey;
    const publicKey = keys.publicKey;

    // 証明書を作成
    const cert = forge.pki.createCertificate();
    cert.publicKey = publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notAfter.getFullYear() + 10
    ); // 10年有効

    // 証明書の属性を設定
    const attrs = [
      { name: 'countryName', value: 'JP' },
      { name: 'organizationName', value: 'FLM' },
      { name: 'commonName', value: 'FLM API Server' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Subject Alternative Name (SAN) を追加
    // node-forgeのaltNamesは型定義により、適切な形式で作成する必要がある
    // type: 2 = DNS名, type: 7 = IPアドレス
    const altNames: Array<{ type: number; value?: string; ip?: string }> = [];

    // localhost (DNS名)
    altNames.push({ type: 2, value: 'localhost' });

    // 127.0.0.1 (IPアドレス)
    altNames.push({ type: 7, ip: '127.0.0.1' });

    // ローカルIPアドレス (DNS名とIPアドレスの両方)
    if (localIp) {
      // IPアドレスをDNS名としても追加（一部の環境で必要）
      altNames.push({ type: 7, ip: localIp });
    }

    // setExtensionsはany[]を受け取るため、型アサーションを使用
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'subjectAltName',
        altNames: altNames,
      },
    ] as any);

    // 証明書に署名
    cert.sign(privateKey, forge.md.sha256.create());

    // PEM形式に変換
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(privateKey);

    // ファイルに保存
    fs.writeFileSync(certPath, certPem);
    fs.writeFileSync(keyPath, keyPem);

    // ファイルが生成されたか確認
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error('証明書ファイルの生成に失敗しました');
    }

    return { certPath, keyPath };
  } catch (error) {
    console.error('node-forgeによる証明書生成エラー:', error);
    throw new Error(
      `証明書生成に失敗しました。OpenSSLがインストールされていない可能性があります。Windowsの場合、Git for Windowsに含まれています。エラー: ${error}`
    );
  }
}

/**
 * ローカルIPアドレスを取得
 */
async function getLocalIp(): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(
      process.platform === 'win32'
        ? 'powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like \"192.168.*\" -or $_.IPAddress -like \"10.*\" -or ($_.IPAddress -like \"172.*\" -and [int]($_.IPAddress.Split(\".\")[1]) -ge 16 -and [int]($_.IPAddress.Split(\".\")[1]) -le 31)})[0].IPAddress"'
        : "ip -4 addr show | grep -oP '(?<=inet\\s)\\d+(\\.\\d+){3}' | grep -v '127.0.0.1' | head -1"
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 証明書を自動生成（大衆向け: ユーザー操作不要）
 * 証明書がない場合、自動的に生成します
 */
export async function ensureCertificateExists(
  apiId: string,
  port: number
): Promise<{ certPath: string; keyPath: string }> {
  const certPath = getCertPath(apiId);
  const keyPath = getKeyPath(apiId);

  // 既に証明書が存在する場合はそのまま返す
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return { certPath, keyPath };
  }

  // 証明書が存在しない場合は自動生成
  console.log(`HTTPS証明書を自動生成中...（初回のみ、しばらくお待ちください）`);

  const localIp = await getLocalIp();

  try {
    const result = await generateCertificateWithOpenSSL(apiId, port, localIp);
    console.log(`HTTPS証明書の生成が完了しました`);
    return result;
  } catch (error) {
    console.error(`証明書生成エラー:`, error);
    throw error;
  }
}
