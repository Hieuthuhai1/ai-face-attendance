"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PrivacyNoticeProps {
  variant?: "banner" | "dialog" | "inline";
  onAccept?: () => void;
  onDecline?: () => void;
  className?: string;
  showDismiss?: boolean;
}

const PRIVACY_CONTENT = {
  title: "Quyền riêng tư & Dữ liệu khuôn mặt",
  sections: [
    {
      title: "Mục đích sử dụng",
      body: "Dữ liệu khuôn mặt chỉ được dùng để xác minh danh tính khi chấm công (check-in/check-out). Không dùng cho mục đích nào khác.",
    },
    {
      title: "Dữ liệu được lưu",
      body: "Chỉ lưu: mã tham chiếu provider (provider_subject_id), điểm chất lượng, thời gian đăng ký, trạng thái. KHÔNG lưu ảnh thô, template sinh trắc, hay embedding vector.",
    },
    {
      title: "Xử lý dữ liệu",
      body: "Xác minh 1:1 (so sánh ảnh chụp lúc chấm công với mẫu đã đăng ký của chính bạn). Không làm nhận diện 1:N (tìm kiếm trong cơ sở dữ liệu).",
    },
    {
      title: "Lưu trữ & Xóa",
      body: "Ảnh đăng ký tạm thời tự xóa sau 24h. Mẫu khuôn mặt (provider_subject_id) xóa khi bạn rút consent hoặc HR thu hồi, trong 72h. Nhật ký truy cập giữ 12 tháng.",
    },
    {
      title: "Quyền của bạn",
      body: "Bạn có quyền: xem dữ liệu của mình, rút consent (xóa mẫu khuôn mặt), yêu cầu xóa toàn bộ dữ liệu chấm công theo quy định pháp luật. Liên hệ HR để thực hiện.",
    },
    {
      title: "Nhà cung cấp AI",
      body: "Dịch vụ nhận diện khuôn mặt do nhà cung cấp thứ 3 cung cấp (xem cấu hình FACE_PROVIDER). Dữ liệu khuôn mặt được gửi đến provider để tạo/xác minh template. Ký DPA (Data Processing Agreement) với provider.",
    },
  ],
};

export function PrivacyNotice({
  variant = "banner",
  onAccept,
  onDecline,
  className,
  showDismiss = true,
}: PrivacyNoticeProps) {
  const [accepted, setAccepted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Check if user has already accepted (stored in localStorage)
  useEffect(() => {
    const stored = localStorage.getItem("privacy:face:accepted");
    if (stored === "true") {
      setAccepted(true);
    }
  }, []);

  if (accepted && variant !== "dialog") {
    return null;
  }

  const handleAccept = () => {
    setAccepted(true);
    localStorage.setItem("privacy:face:accepted", "true");
    onAccept?.();
  };

  const handleDecline = () => {
    onDecline?.();
  };

  const handleDismiss = () => {
    setAccepted(true);
    localStorage.setItem("privacy:face:accepted", "true");
  };

  if (variant === "dialog") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-xl">
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
            <h2 id="privacy-title" className="text-lg font-semibold text-slate-900">{PRIVACY_CONTENT.title}</h2>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              aria-label="Đóng"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {PRIVACY_CONTENT.sections.map((section, index) => (
              <div key={index} className="border-b border-slate-100 pb-4 last:pb-0">
                <h3 className="font-medium text-slate-900 mb-1">{section.title}</h3>
                <p className="text-sm text-slate-600">{section.body}</p>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-200 flex gap-3">
              <Button variant="secondary" onClick={handleDecline} className="flex-1">
                Không đồng ý
              </Button>
              <Button onClick={handleAccept} className="flex-1">
                Đồng ý & Tiếp tục
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "rounded-xl border border-amber-200 bg-amber-50 p-4",
          className
        )}
        role="note"
        aria-label="Thông báo quyền riêng tư"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Badge tone="warning" className="text-xs">
              <Icon name="alert" size={12} /> Quyền riêng tư
            </Badge>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">{PRIVACY_CONTENT.title}</p>
            <p className="mt-1 text-sm text-amber-700">
              Dữ liệu khuôn mặt chỉ dùng để xác minh chấm công. Chỉ lưu mã tham chiếu, không lưu ảnh/template.
              <a href="#" className="underline hover:text-amber-900 ml-1" onClick={(e) => { e.preventDefault(); setShowDetails(true); }}>
                Xem chi tiết
              </a>
            </p>
            {!accepted && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleAccept}>
                  <Icon name="check" size={14} /> Đồng ý
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDecline}>
                  <Icon name="x" size={14} /> Không đồng ý
                </Button>
              </div>
            )}
          </div>
          {showDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-amber-400 hover:text-amber-600 rounded hover:bg-amber-100"
              aria-label="Đóng thông báo"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Icon name="shield" size={18} className="text-[var(--brand)]" />
        {PRIVACY_CONTENT.title}
      </h3>
      <div className="space-y-3">
        {PRIVACY_CONTENT.sections.map((section, index) => (
          <div key={index} className="border-l-2 border-slate-200 pl-3">
            <h4 className="font-medium text-slate-900">{section.title}</h4>
            <p className="text-sm text-slate-600 mt-1">{section.body}</p>
          </div>
        ))}
        {!accepted && (
          <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-200">
            <Button onClick={handleAccept} className="flex-1 min-w-[120px]">
              <Icon name="check" size={14} /> Đồng ý
            </Button>
            <Button variant="secondary" onClick={handleDecline} className="flex-1 min-w-[120px]">
              <Icon name="x" size={14} /> Không đồng ý
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}