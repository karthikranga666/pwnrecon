import { jsPDF } from 'jspdf';

const C = {
  bg: [8, 11, 15],
  surface: [13, 17, 23],
  border: [28, 35, 51],
  green: [0, 255, 136],
  red: [255, 68, 68],
  amber: [255, 184, 0],
  blue: [77, 159, 255],
  text: [230, 237, 243],
  muted: [125, 133, 144]
};

function severityColor(sev) {
  if (sev === 'critical') return C.red;
  if (sev === 'high') return [255, 100, 50];
  if (sev === 'medium') return C.amber;
  if (sev === 'low') return C.blue;
  return C.muted;
}

export function exportPDF(result) {
  const { domain, timestamp, modules, risk } = result;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const MARGIN = 14;
  const COL = W - MARGIN * 2;
  let y = 0;

  // --- helpers ---
  function pageCheck(needed = 10) {
    if (y + needed > 275) {
      doc.addPage();
      drawPageBg();
      y = 16;
    }
  }

  function drawPageBg() {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, 210, 297, 'F');
  }

  function text(str, x, yy, opts = {}) {
    doc.setTextColor(...(opts.color || C.text));
    doc.setFontSize(opts.size || 9);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.text(String(str), x, yy, { maxWidth: opts.maxWidth });
  }

  function rule(yy, color = C.border) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, yy, W - MARGIN, yy);
  }

  function badge(label, x, yy, color) {
    doc.setFillColor(color[0], color[1], color[2], 0.15);
    const w = doc.getTextWidth(label) + 4;
    doc.roundedRect(x, yy - 3.5, w, 5, 1, 1, 'F');
    doc.setTextColor(...color);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 2, yy);
    return w + 2;
  }

  function sectionHeader(title) {
    pageCheck(14);
    doc.setFillColor(...C.surface);
    doc.rect(MARGIN, y, COL, 8, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, COL, 8, 'S');
    text(title, MARGIN + 3, y + 5.5, { bold: true, size: 9, color: C.green });
    y += 12;
  }

  function row(label, value, color) {
    pageCheck(7);
    text(label, MARGIN + 2, y, { size: 8, color: C.muted });
    text(value, MARGIN + 48, y, { size: 8, color: color || C.text, maxWidth: COL - 50 });
    y += 5.5;
  }

  // ── PAGE 1 ──────────────────────────────────────────────────────
  drawPageBg();
  y = 18;

  // Title block
  doc.setFillColor(...C.surface);
  doc.roundedRect(MARGIN, y, COL, 28, 2, 2, 'F');
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 28, W - MARGIN, y + 28);

  text('PWNRECON', MARGIN + 4, y + 8, { bold: true, size: 18, color: C.green });
  text('Security Reconnaissance Report', MARGIN + 4, y + 15, { size: 9, color: C.text });
  text(`Target: ${domain}`, MARGIN + 4, y + 21, { size: 8, color: C.muted });
  text(`Generated: ${new Date(timestamp).toLocaleString()}`, MARGIN + 4, y + 26, { size: 7, color: C.muted });

  // Risk score circle area
  const scoreColor = risk.score >= 80 ? C.red : risk.score >= 60 ? [255, 100, 50] : risk.score >= 40 ? C.amber : C.green;
  text(`${risk.score}/100`, W - MARGIN - 20, y + 12, { bold: true, size: 16, color: scoreColor });
  text(risk.category, W - MARGIN - 20, y + 20, { size: 8, color: scoreColor });
  text('RISK', W - MARGIN - 20, y + 26, { size: 7, color: C.muted });

  y += 36;

  // Risk counts
  const counts = risk.counts || {};
  const countEntries = [['CRITICAL', counts.critical || 0, C.red], ['HIGH', counts.high || 0, [255, 100, 50]], ['MEDIUM', counts.medium || 0, C.amber], ['LOW', counts.low || 0, C.blue]];
  const cellW = COL / 4;
  countEntries.forEach(([label, count, color], i) => {
    const cx = MARGIN + i * cellW;
    doc.setFillColor(...C.surface);
    doc.roundedRect(cx, y, cellW - 2, 14, 1, 1, 'F');
    text(String(count), cx + cellW / 2 - 3, y + 8, { bold: true, size: 12, color });
    text(label, cx + cellW / 2 - 6, y + 12.5, { size: 6, color: C.muted });
  });
  y += 20;

  // Attack surface
  if (risk.attackSurface?.vectors?.length) {
    sectionHeader('ATTACK SURFACE');
    risk.attackSurface.vectors.forEach(v => {
      pageCheck(7);
      text(`› ${v}`, MARGIN + 3, y, { size: 8, color: C.text, maxWidth: COL - 6 });
      y += 6;
    });
    y += 3;
  }

  // Findings
  if (risk.findings?.length) {
    sectionHeader('FINDINGS');
    risk.findings.slice(0, 20).forEach(f => {
      pageCheck(16);
      const color = severityColor(f.severity);
      badge(f.severity, MARGIN + 2, y + 1, color);
      text(f.title, MARGIN + 22, y + 1, { size: 8, bold: true, color: C.text, maxWidth: COL - 24 });
      y += 5.5;
      if (f.remediation) {
        text(`Fix: ${f.remediation}`, MARGIN + 4, y, { size: 7, color: C.muted, maxWidth: COL - 8 });
        y += 5;
      }
      y += 1;
    });
    y += 3;
  }

  // DNS
  if (modules.dns && !modules.dns.error) {
    const dns = modules.dns;
    sectionHeader('DNS');
    row('Subdomains found', String(dns.subdomains?.length || 0));
    row('SPF', dns.emailSecurity?.spf?.present ? 'Present' : 'MISSING', dns.emailSecurity?.spf?.present ? C.green : C.red);
    row('DMARC', dns.emailSecurity?.dmarc?.present ? 'Present' : 'MISSING', dns.emailSecurity?.dmarc?.present ? C.green : C.red);
    row('DKIM', dns.emailSecurity?.dkim?.present ? 'Present' : 'MISSING', dns.emailSecurity?.dkim?.present ? C.green : C.red);
    row('Zone Transfer', dns.zoneTransfer?.vulnerable ? 'VULNERABLE' : 'Secure', dns.zoneTransfer?.vulnerable ? C.red : C.green);
    if (dns.subdomains?.length) {
      pageCheck(8);
      text('Live subdomains:', MARGIN + 2, y, { size: 7, color: C.muted });
      y += 5;
      dns.subdomains.slice(0, 15).forEach(s => {
        pageCheck(5);
        text(`  ${s.subdomain}  ${s.ip || ''}`, MARGIN + 4, y, { size: 7, color: C.text });
        y += 4.5;
      });
    }
    y += 3;
  }

  // TLS
  if (modules.tls && !modules.tls.error) {
    const tls = modules.tls;
    sectionHeader('TLS / SSL');
    row('Grade', tls.grade || 'N/A', tls.grade === 'A' || tls.grade === 'A+' ? C.green : C.red);
    row('Protocol', tls.protocol || 'unknown');
    row('Cipher', tls.cipher?.name || 'unknown');
    row('Expires in', tls.cert?.daysRemaining != null ? `${tls.cert.daysRemaining} days` : 'N/A', tls.cert?.daysRemaining < 30 ? C.red : C.text);
    row('Self-signed', tls.cert?.selfSigned ? 'YES' : 'No', tls.cert?.selfSigned ? C.red : C.green);
    if (tls.cert?.san?.length) {
      row('SANs', tls.cert.san.slice(0, 5).join(', '));
    }
    y += 3;
  }

  // HTTP
  if (modules.http && !modules.http.error) {
    const http = modules.http;
    sectionHeader('HTTP FINGERPRINT');
    row('HTTPS Redirect', http.httpsRedirect ? 'Yes' : 'NO', http.httpsRedirect ? C.green : C.red);
    row('WAF', http.waf || 'None detected', http.waf ? C.green : C.muted);
    row('Server', http.server || 'Hidden');
    row('Open Redirect', http.openRedirect?.vulnerable ? 'VULNERABLE' : 'Not detected', http.openRedirect?.vulnerable ? C.red : C.green);
    if (http.techStack?.length) {
      row('Tech Stack', http.techStack.map(t => t.name).join(', '));
    }
    y += 3;
  }

  // Security Headers
  if (modules.secHeaders && !modules.secHeaders.error) {
    const h = modules.secHeaders;
    sectionHeader('SECURITY HEADERS');
    row('Score', `${h.score}/100`, h.score >= 80 ? C.green : h.score >= 50 ? C.amber : C.red);
    (h.results || []).forEach(r => {
      pageCheck(6);
      const color = r.status === 'pass' ? C.green : r.status === 'warn' ? C.amber : C.red;
      const icon = r.status === 'pass' ? '✓' : '✗';
      text(`${icon} ${r.name}`, MARGIN + 4, y, { size: 8, color });
      y += 5;
    });
    y += 3;
  }

  // Ports
  if (modules.ports && !modules.ports.error) {
    const ports = modules.ports;
    sectionHeader('PORT SCAN');
    row('Total scanned', String(ports.total));
    row('Open ports', String(ports.open?.length || 0), ports.open?.length > 0 ? C.amber : C.green);
    (ports.open || []).forEach(p => {
      pageCheck(7);
      const color = p.risky ? C.red : C.green;
      text(`${p.port}`, MARGIN + 4, y, { size: 8, bold: true, color });
      text(`${p.service}${p.software && p.software !== p.service ? ' / ' + p.software : ''}${p.version ? ' ' + p.version : ''}`, MARGIN + 20, y, { size: 8, color: C.text });
      if (p.risky) badge('RISKY', W - MARGIN - 18, y + 1, C.red);
      y += 5.5;
    });
    y += 3;
  }

  // Footer on last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    rule(287);
    text(`PwnRecon Security Report — ${domain}`, MARGIN, 292, { size: 7, color: C.muted });
    text(`Page ${i} / ${totalPages}`, W - MARGIN - 20, 292, { size: 7, color: C.muted });
  }

  doc.save(`pwnrecon-${domain}-${Date.now()}.pdf`);
}
