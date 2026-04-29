import tls from 'tls';
import https from 'https';

const WEAK_CIPHERS = ['RC4','DES','3DES','EXPORT','NULL','ANON','MD5','PSK'];
const OLD_PROTOCOLS = ['TLSv1','TLSv1.1','SSLv2','SSLv3'];

function gradeTLS({ protocol, cipher, cert }) {
  if (!cert || cert.selfSigned) return 'F';
  if (cert.expired) return 'F';
  if (OLD_PROTOCOLS.includes(protocol)) return 'C';
  if (WEAK_CIPHERS.some(w => cipher?.name?.toUpperCase().includes(w))) return 'C';
  if (protocol === 'TLSv1.2') return 'B';
  if (protocol === 'TLSv1.3') return 'A';
  return 'B';
}

function parseCert(cert) {
  if (!cert) return null;

  const now = new Date();
  const validTo = new Date(cert.valid_to);
  const validFrom = new Date(cert.valid_from);
  const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

  const san = cert.subjectaltname
    ? cert.subjectaltname.split(', ').map(s => s.replace(/^DNS:/, ''))
    : [];

  const issuer = cert.issuer || {};
  const subject = cert.subject || {};
  const selfSigned = issuer.CN === subject.CN && issuer.O === subject.O;

  return {
    subject: subject.CN || subject.O || 'Unknown',
    issuer: issuer.O || issuer.CN || 'Unknown',
    issuerCN: issuer.CN || 'Unknown',
    validFrom: cert.valid_from,
    validTo: cert.valid_to,
    daysRemaining,
    expired: daysRemaining < 0,
    expiringSoon: daysRemaining >= 0 && daysRemaining < 30,
    selfSigned,
    san,
    fingerprint: cert.fingerprint || null,
    fingerprint256: cert.fingerprint256 || null,
    serialNumber: cert.serialNumber || null
  };
}

export async function runTLS(domain) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ error: 'TLS connection timeout', available: false });
    }, 10000);

    const options = {
      host: domain,
      port: 443,
      rejectUnauthorized: false,
      servername: domain,
      timeout: 10000
    };

    const socket = tls.connect(options, () => {
      clearTimeout(timeout);
      try {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        const authorized = socket.authorized;

        const parsedCert = parseCert(cert);
        const grade = gradeTLS({ protocol, cipher, cert: parsedCert });

        const findings = generateTLSFindings({ protocol, cipher, cert: parsedCert, authorized });

        socket.destroy();
        resolve({
          available: true,
          protocol,
          cipher: {
            name: cipher?.name,
            version: cipher?.version,
            bits: cipher?.bits
          },
          authorized,
          cert: parsedCert,
          grade,
          findings
        });
      } catch (e) {
        socket.destroy();
        resolve({ error: e.message, available: false });
      }
    });

    socket.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ error: e.message, available: false });
    });

    socket.setTimeout(10000, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ error: 'Socket timeout', available: false });
    });
  });
}

function generateTLSFindings({ protocol, cipher, cert, authorized }) {
  const findings = [];

  if (!cert) {
    findings.push({ severity: 'critical', title: 'No TLS Certificate', detail: 'Could not retrieve TLS certificate', remediation: 'Install a valid TLS certificate' });
    return findings;
  }

  if (cert.expired) {
    findings.push({ severity: 'critical', title: 'Certificate Expired', detail: `Certificate expired ${Math.abs(cert.daysRemaining)} days ago`, remediation: 'Renew certificate immediately' });
  } else if (cert.expiringSoon) {
    findings.push({ severity: 'high', title: 'Certificate Expiring Soon', detail: `Certificate expires in ${cert.daysRemaining} days`, remediation: 'Renew certificate before expiry' });
  }

  if (cert.selfSigned) {
    findings.push({ severity: 'high', title: 'Self-Signed Certificate', detail: 'Certificate not issued by trusted CA — MITM attacks easier', remediation: 'Use a certificate from Let\'s Encrypt or a trusted CA' });
  }

  if (OLD_PROTOCOLS.includes(protocol)) {
    findings.push({ severity: 'high', title: `Weak Protocol: ${protocol}`, detail: `${protocol} is deprecated and vulnerable to BEAST/POODLE attacks`, remediation: 'Disable TLS 1.0/1.1, enable TLS 1.2/1.3 only' });
  }

  if (cipher && WEAK_CIPHERS.some(w => cipher.name?.toUpperCase().includes(w))) {
    findings.push({ severity: 'high', title: `Weak Cipher: ${cipher.name}`, detail: 'Weak cipher suite enables decryption attacks', remediation: 'Configure server to use only strong ciphers (AES-GCM, ChaCha20)' });
  }

  if (!authorized) {
    findings.push({ severity: 'medium', title: 'Certificate Not Trusted', detail: 'Certificate chain validation failed', remediation: 'Ensure full certificate chain is served correctly' });
  }

  return findings;
}
