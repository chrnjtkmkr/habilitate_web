import html2pdf from 'html2pdf.js';
import { supabase } from '../supabase';

export async function generateAndUploadReportPdf(opts: {
  reportId: string;
  centerId: string;
  childId: string;
  previewElement: HTMLElement;
  filename: string;
}): Promise<{ pdfUrl: string }> {
  const { reportId, centerId, childId, previewElement, filename } = opts;

  // Render DOM to PDF blob
  const pdfBlob: Blob = await html2pdf()
    .set({
      margin: [12, 12, 12, 12],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(previewElement)
    .outputPdf('blob');

  // Upload to Storage
  const storagePath = `${centerId}/${childId}/${reportId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('parent-reports')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) throw uploadErr;

  // Get signed URL (7-day TTL)
  const { data: signed, error: signedErr } = await supabase.storage
    .from('parent-reports')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signedErr || !signed) throw signedErr ?? new Error('signed url failed');

  // Update report row
  const { error: updateErr } = await supabase
    .from('parent_reports')
    .update({ pdf_url: signed.signedUrl })
    .eq('id', reportId);
  if (updateErr) throw updateErr;

  // Trigger local download
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return { pdfUrl: signed.signedUrl };
}

// Generate a fresh short-lived signed URL and open it.
// Avoids the stale-JWT problem when pdf_url has expired.
export async function openPdfFresh(opts: {
  centerId: string;
  childId: string;
  reportId: string;
}): Promise<void> {
  const storagePath = `${opts.centerId}/${opts.childId}/${opts.reportId}.pdf`;
  const { data, error } = await supabase.storage
    .from('parent-reports')
    .createSignedUrl(storagePath, 60 * 60); // 1-hour TTL
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not generate PDF link');
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
