import { useState, useMemo, useRef } from 'react';
import Modal from '../components/Modal';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import {
  useParentReport,
  useUpdateReportContent,
  useSendForApproval,
  useApproveReport,
  useRenderReportPdf,
} from '../lib/queries/parentReports';
import type { ReportContent, GoalWorked } from '../lib/reports/generate';
import Button from '../components/Button';
import Pill from '../components/Pill';
import Textarea from '../components/Textarea';
import Skeleton from '../components/Skeleton';
import { useToast } from '../lib/toastStore';

export default function ReportEditor() {
  const { t } = useTranslation();
  const { reportId } = useParams<{ id: string; reportId: string }>();
  const { user, memberships } = useAuth();
  const { data: report, isLoading, isError: reportError } = useParentReport(reportId);
  const updateContent = useUpdateReportContent();
  const sendForApproval = useSendForApproval();
  const approveReport = useApproveReport();
  const renderPdf = useRenderReportPdf();
  const toast = useToast((s) => s.add);
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false);

  const centerId = memberships[0]?.center_id;
  const role = memberships[0]?.role;
  const canApprove = role === 'center_owner' || role === 'supervising_therapist';

  const initialContent = useMemo(
    () => (report?.content ? (report.content as unknown as ReportContent) : null),
    [report],
  );
  const [content, setContent] = useState<ReportContent | null>(null);
  // Sync local state when report data first loads or changes
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (report && report.id !== loadedId) {
    setLoadedId(report.id);
    if (initialContent) setContent(initialContent);
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (reportError || !report || !content) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center"><p className="text-ink-secondary">{t('error_generic')}</p></div>;
  }

  function updateGoal(idx: number, field: keyof GoalWorked, value: string) {
    if (!content) return;
    const goalsWorked = [...content.goalsWorked];
    goalsWorked[idx] = { ...goalsWorked[idx], [field]: value };
    setContent({ ...content, goalsWorked });
  }

  function updateTip(idx: number, value: string) {
    if (!content) return;
    const parentTips = [...content.parentTips];
    parentTips[idx] = { ...parentTips[idx], tipText: value };
    setContent({ ...content, parentTips });
  }

  function removeTip(idx: number) {
    if (!content) return;
    setContent({ ...content, parentTips: content.parentTips.filter((_, i) => i !== idx) });
  }

  function addTip() {
    if (!content) return;
    setContent({ ...content, parentTips: [...content.parentTips, { tipText: '' }] });
  }

  async function handleSave() {
    if (!content || !reportId || !centerId || !user) return;
    try {
      await updateContent.mutateAsync({ reportId, content, actorId: user.id, centerId });
      toast(t('report_saved'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleSendForApproval() {
    if (!reportId || !centerId || !user) return;
    await handleSave();
    try {
      await sendForApproval.mutateAsync({ reportId, actorId: user.id, centerId });
      toast(t('report_sent_for_approval'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleApprove() {
    if (!reportId || !centerId || !user) return;
    try {
      await approveReport.mutateAsync({ reportId, actorId: user.id, centerId });
      toast(t('report_approved'), 'success');
    } catch {
      toast(t('error_generic'), 'error');
    }
  }

  async function handleDownloadPdf() {
    if (!reportId || !centerId || !user || !content || !previewRef.current || !report) return;
    const childId = report.child_id;
    const filename = `report_${content.childFirstName}_${report.period_start}_${content.language}.pdf`;
    try {
      await renderPdf.mutateAsync({
        reportId,
        childId,
        centerId,
        actorId: user.id,
        previewElement: previewRef.current,
        filename,
      });
      toast(t('pdf_ready'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('error_generic'), 'error');
    }
  }

  const statusKey = `report_status_${report.status}`;
  const isDraft = report.status === 'draft';
  const isAwaiting = report.status === 'awaiting_approval';
  const isApproved = report.status === 'approved' || report.status === 'sent';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">{t('report_editor_title')}</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {content.childFirstName} &mdash; {content.periodLabel}
          </p>
        </div>
        <Pill variant={report.status === 'approved' || report.status === 'sent' ? 'success' : report.status === 'awaiting_approval' ? 'warning' : 'neutral'}>
          {t(statusKey)}
        </Pill>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Editor */}
        <div className="space-y-6">
          {/* Sessions summary */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-lg font-medium text-ink-primary">{t('sessions_summary')}</h2>
            <p className="text-sm text-ink-secondary">
              {t('sessions_attended_count', {
                attended: content.sessionsAttended,
                scheduled: content.sessionsScheduled,
              })}
            </p>
          </section>

          {/* Goals worked */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-medium text-ink-primary">{t('goals_worked')}</h2>
            <div className="space-y-4">
              {content.goalsWorked.map((g, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-primary">{g.goalName}</span>
                    <Pill>{g.domain}</Pill>
                  </div>
                  <Textarea
                    label={g.goalName}
                    value={g.observationText}
                    onChange={(e) => updateGoal(idx, 'observationText', e.currentTarget.value)}
                    rows={3}
                    disabled={isApproved}
                  />
                </div>
              ))}
              {content.goalsWorked.length === 0 && (
                <p className="text-sm text-ink-secondary">{t('no_goals_yet')}</p>
              )}
            </div>
          </section>

          {/* Parent tips */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-ink-primary">{t('parent_tips')}</h2>
              {!isApproved && (
                <button onClick={addTip} className="text-sm text-primary-600 hover:underline">
                  {t('add_tip')}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {content.parentTips.map((tip, idx) => (
                <div key={idx} className="flex gap-2">
                  <Textarea
                    label={`${t('parent_tips')} ${idx + 1}`}
                    value={tip.tipText}
                    onChange={(e) => updateTip(idx, e.currentTarget.value)}
                    rows={2}
                    className="flex-1"
                    disabled={isApproved}
                  />
                  {!isApproved && (
                    <button
                      onClick={() => removeTip(idx)}
                      className="self-start text-xs text-red-600 hover:underline"
                    >
                      {t('remove_tip')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Closing note */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-lg font-medium text-ink-primary">{t('closing_note')}</h2>
            <Textarea
              label={t('closing_note')}
              value={content.closingNote}
              onChange={(e) => setContent({ ...content, closingNote: e.currentTarget.value })}
              rows={2}
              disabled={isApproved}
            />
          </section>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button onClick={handleSave} disabled={updateContent.isPending}>
                  {t('save_draft')}
                </Button>
                <Button variant="secondary" onClick={handleSendForApproval} disabled={sendForApproval.isPending}>
                  {t('send_for_approval')}
                </Button>
              </>
            )}
            {isAwaiting && canApprove && (
              <Button onClick={handleApprove} disabled={approveReport.isPending}>
                {t('approve_report')}
              </Button>
            )}
            {isAwaiting && !canApprove && (
              <Button onClick={handleSave} disabled={updateContent.isPending}>
                {t('save_draft')}
              </Button>
            )}
            {isApproved && (
              <span data-tour="download-pdf">
                <Button onClick={() => setDownloadConfirmOpen(true)} disabled={renderPdf.isPending}>
                  {renderPdf.isPending ? t('pdf_generating') : t('download_pdf')}
                </Button>
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div ref={previewRef} className="rounded-2xl border border-border bg-white p-6 shadow-sm" data-tour="report-preview">
          <ReportPreview content={content} generatedAt={report.created_at} />
        </div>
      </div>

      {/* Download confirmation — only rendered when explicitly opened on an approved report */}
      {downloadConfirmOpen && content && (
        <Modal open onClose={() => setDownloadConfirmOpen(false)} title={t('pdf_confirm_title')}>
          <div className="space-y-4">
            <p className="text-sm text-ink-primary">
              {t('pdf_confirm_body', { child: content.childFirstName })}
            </p>
            <div className="rounded-lg border border-border bg-background p-3 text-sm text-ink-secondary space-y-1">
              <p>{t('pdf_confirm_sessions', { attended: content.sessionsAttended, scheduled: content.sessionsScheduled })}</p>
              {content.goalsWorked.length > 0 && (
                <p>{t('pdf_confirm_goals', { goals: content.goalsWorked.map(g => g.goalName).join(', ') })}</p>
              )}
              <p>{t('pdf_confirm_includes_note')}</p>
            </div>
            <p className="text-xs text-ink-muted">{t('pdf_confirm_no_edit_after')}</p>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setDownloadConfirmOpen(false)}>
                {t('pdf_confirm_review')}
              </Button>
              <Button onClick={() => { setDownloadConfirmOpen(false); handleDownloadPdf(); }}>
                {t('pdf_confirm_proceed')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// PDF-like preview rendered in React, same structure as the PDF template
function ReportPreview({ content, generatedAt }: { content: ReportContent; generatedAt: string }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="border-b border-primary-200 pb-4">
        <h2 className="text-xl font-bold text-primary-700">{content.centerName}</h2>
        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-base font-semibold text-ink-primary">{t('progress_report')}</p>
            <p className="text-xs text-ink-secondary">{content.periodLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-ink-primary">{content.childFirstName}</p>
            <p className="text-xs text-ink-secondary">
              {t('report_child_age', { age: content.childAgeYearsMonths })}
            </p>
          </div>
        </div>
      </div>

      {/* Sessions summary */}
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="font-medium text-ink-primary">{t('sessions_summary')}</p>
        <p className="text-ink-secondary">
          {t('sessions_attended_count', {
            attended: content.sessionsAttended,
            scheduled: content.sessionsScheduled,
          })}
        </p>
      </div>

      {/* What we worked on — hide if no goals */}
      {content.goalsWorked.filter((g) => g.goalName.trim() || g.observationText.trim()).length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-ink-primary">{t('report_section_what_we_worked_on')}</h3>
          <div className="space-y-3">
            {content.goalsWorked.map((g, idx) => (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-ink-primary">{g.goalName}</span>
                  <span className="rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                    {g.domain}
                  </span>
                </div>
                <p className="text-ink-secondary">{g.observationText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Things to try at home — hide if all tips are empty */}
      {content.parentTips.filter((tip) => tip.tipText.trim()).length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-ink-primary">{t('report_section_things_to_try')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            {content.parentTips.filter((tip) => tip.tipText.trim()).map((tip, idx) => (
              <li key={idx} className="text-ink-secondary">{tip.tipText}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next session */}
      {content.nextSessionDate && (
        <div>
          <h3 className="mb-1 font-semibold text-ink-primary">{t('report_section_next_session')}</h3>
          <p className="text-ink-secondary">{format(new Date(content.nextSessionDate), 'PP')}</p>
        </div>
      )}

      {/* Closing note */}
      <p className="italic text-ink-secondary">{content.closingNote}</p>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-4 text-xs text-ink-muted">
        <div className="flex justify-between">
          <div>
            <p>{t('report_therapist_label')}: {content.therapistName}</p>
            <p>{t('report_supervisor_label')}: {content.supervisorName}</p>
          </div>
          <div className="text-right">
            <p>{content.centerName}</p>
            <p>{t('report_footer_generated', { date: format(new Date(generatedAt), 'PP') })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
