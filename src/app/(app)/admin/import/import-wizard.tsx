"use client";

import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Mail,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { CopyLinkButton } from "@/components/app/copy-link";
import type { DryRunReport, ImportApplyResult } from "@/modules/enrollment";
import {
  applyImportAction,
  dryRunImportAction,
  emailAllInvitesAction,
} from "@/modules/enrollment/actions";

const SAMPLE_CSV = `name,email,role,student_number,phone,term,course,section
Alice Johnson,alice@college.edu,student,STU-101,+15551234567,Fall 2026,CS101,SEC-01
Bob Smith,bob@college.edu,student,STU-102,+15552345678,Fall 2026,CS101,SEC-01
Dr. Carol White,carol@college.edu,faculty,EMP-001,+15553456789,,,`;

export function ImportWizard() {
  const [csvContent, setCsvContent] = useState("");
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError("File exceeds 1 MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setDryRunReport(null);
      setApplyResult(null);
      setError(null);
    };
    reader.readAsText(file);
  };

  const runDryRun = async () => {
    setDryRunLoading(true);
    setError(null);
    setApplyResult(null);

    try {
      const res = await dryRunImportAction({ csvContent });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setDryRunReport(res.value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Dry run failed.");
    } finally {
      setDryRunLoading(false);
    }
  };

  const runApply = async () => {
    setApplyLoading(true);
    setError(null);

    try {
      const res = await applyImportAction({ csvContent });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setApplyResult(res.value);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Import application failed.",
      );
    } finally {
      setApplyLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!applyResult?.downloadableCsv) return;
    const blob = new Blob([applyResult.downloadableCsv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `onboarding-invites-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEmailAll = async () => {
    if (!applyResult || applyResult.newInvites.length === 0) return;
    setEmailLoading(true);
    setEmailNotice(null);

    try {
      const invitesToSend = applyResult.newInvites.map((inv) => ({
        userId: inv.userId,
        inviteUrl: inv.inviteUrl,
        name: inv.name,
      }));

      const res = await emailAllInvitesAction({ invites: invitesToSend });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      setEmailNotice(
        `Successfully queued ${res.value.enqueued} onboarding invite email(s). Deliveries are dispatched respecting the daily email sending cap; any volume above the cap will be deferred to subsequent days.`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to queue invite emails.",
      );
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Step 1: Input & Dry Run */}
      {!applyResult && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Step 1: Upload & Validate Spreadsheet
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Upload CSV or edit below (up to 1 MB and 2,000 rows). Dry run
                validates format and natural keys without writing anything.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCsvContent(SAMPLE_CSV)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
              >
                Load Sample
              </button>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Choose File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <textarea
            rows={7}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder={SAMPLE_CSV}
            className="w-full font-mono text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none resize-y"
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={runDryRun}
              disabled={dryRunLoading || !csvContent.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {dryRunLoading ? "Verifying..." : "Run Dry-Run Verification"}
            </button>
          </div>
        </div>
      )}

      {/* Dry Run Report */}
      {dryRunReport && !applyResult && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">
              Dry-Run Analysis Report (Ready to Apply)
            </h3>
            <span className="text-xs text-zinc-400">
              Database state unchanged (0 writes)
            </span>
          </div>

          {/* Stat Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-400">Total Rows</div>
              <div className="text-xl font-bold text-white">
                {dryRunReport.totalRows}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-emerald-400">New Accounts</div>
              <div className="text-xl font-bold text-emerald-400">
                +{dryRunReport.createdUsers}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-blue-400">Existing (Updates)</div>
              <div className="text-xl font-bold text-blue-400">
                {dryRunReport.updatedUsers}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-purple-400">Enrollments</div>
              <div className="text-xl font-bold text-purple-400">
                +{dryRunReport.createdEnrollments}
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {dryRunReport.errors.length > 0 && (
            <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-red-300 uppercase tracking-wider">
                {dryRunReport.errors.length} Format / Validation Error(s) Found
              </h4>
              <ul className="text-xs text-red-200 divide-y divide-red-900/40">
                {dryRunReport.errors.map((err) => (
                  <li
                    key={`err-${err.line}-${err.field ?? "general"}-${err.message}`}
                    className="py-1 flex items-start gap-2"
                  >
                    <span className="font-mono font-bold text-red-400">
                      Line {err.line}:
                    </span>
                    <span>{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply Button */}
          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              disabled={applyLoading || dryRunReport.errors.length > 0}
              onClick={runApply}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              {applyLoading
                ? "Applying in Transaction..."
                : "Step 2: Apply Everything to Database"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Results & Onboarding */}
      {applyResult && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-medium mb-1">
                <CheckCircle className="w-5 h-5" />
                Import Completed Successfully in One Transaction
              </div>
              <p className="text-xs text-zinc-400">
                Created {applyResult.createdUsers} new users, updated{" "}
                {applyResult.updatedUsers} existing profiles, and registered{" "}
                {applyResult.createdEnrollments} enrollments.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Invites CSV
              </button>
              <button
                type="button"
                onClick={handleEmailAll}
                disabled={emailLoading || applyResult.newInvites.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                {emailLoading ? "Queuing..." : "Email All Invites"}
              </button>
            </div>
          </div>

          {emailNotice && (
            <div className="p-3 bg-blue-950/60 border border-blue-800 rounded-lg text-blue-200 text-xs flex items-start gap-2">
              <Mail className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>{emailNotice}</span>
            </div>
          )}

          {/* Onboarding Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">
              Onboarding Invitation Links ({applyResult.newInvites.length} new
              accounts)
            </h4>

            {applyResult.newInvites.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">
                All imported users already hold accounts in the system. No new
                invitations needed.
              </p>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5">Role</th>
                      <th className="px-3 py-2.5 text-right">Invite Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {applyResult.newInvites.map((inv) => (
                      <tr key={inv.userId} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 font-medium text-white">
                          {inv.name}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{inv.email}</td>
                        <td className="px-3 py-2 capitalize text-zinc-400">
                          {inv.role}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <CopyLinkButton
                            url={inv.inviteUrl}
                            label="Copy Invite Link"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setApplyResult(null);
                setDryRunReport(null);
                setCsvContent("");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              Start Another Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
