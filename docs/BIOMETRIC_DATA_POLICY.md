# Biometric Data Policy (tóm tắt áp dụng cho dự án)

> Tài liệu nội bộ phục vụ triển khai kỹ thuật. Trước production, tổ chức phải cho
> pháp chế/HR rà soát theo quy định bảo vệ dữ liệu cá nhân hiện hành.

## 1. Nguyên tắc

1. **Mục đích giới hạn:** dữ liệu khuôn mặt chỉ dùng để xác minh chấm công đã thông báo.
   Không dùng để suy luận cảm xúc, sức khỏe, sắc tộc hay thuộc tính không liên quan.
2. **Tối thiểu hóa:** mặc định KHÔNG lưu ảnh/video/frame camera thô.
   Chỉ giữ: provider subject ID / template reference, quality score, timestamps,
   consent record, verification metadata tối thiểu.
3. **Không client-side biometrics:** không trả template/embedding về frontend;
   không ghi frame/biometric payload vào log (logger tự redact).
4. **Consent:** enrollment yêu cầu hiển thị thông báo (mục đích, loại dữ liệu, thời gian
   lưu, quyền truy cập, cách xóa, phương án thay thế) + xác nhận của nhân viên +
   HR xác minh danh tính trước khi active. Lưu consent version + thời điểm.
   (Đã triển khai consent v1 ở Phase 4: `src/features/face-enrollment/consent.ts`,
   submit không consent → `CONSENT_REQUIRED`.)
5. **Thu hồi:** nhân viên rút consent → revoke subject ở provider + xóa enrollment
   trong SLA 72h, có audit log.

## 2. Lưu trữ & retention (mặc định)

| Dữ liệu | Giữ | Xóa |
|---|---|---|
| Frame/ảnh tạm khi enroll/verify | Chỉ trong RAM/request, lâu nhất ở bucket tạm | TTL ≤ 24h (cron), xóa ngay sau xử lý nếu được |
| Provider subject ID + quality | Suốt thời gian làm việc + enrollment active | Khi revoke/rút consent/nghỉ việc theo SLA |
| Attendance events/summaries | 24 tháng (đề xuất, chờ HR chốt) | Archive theo chính sách |
| Access/export audit logs | 12 tháng | Xoay vòng |

Nếu provider bắt buộc lưu ảnh phía họ: ghi rõ trong `docs/PROVIDER_SETUP.md`
trước khi bật, kèm DPA, vùng lưu trữ và retention của provider.

## 3. Truy cập

- Employee: chỉ dữ liệu của mình. Manager: team mình, không xem template.
- HR: vận hành enrollment, không xem secret provider/template nếu không cần.
- System Admin: cấu hình kỹ thuật, không mặc định xem dữ liệu sinh trắc giải mã.
- Mọi truy cập/duyệt/export enrollment ghi audit log.

## 4. Vi phạm & báo cáo

Mọi truy cập bất thường vào dữ liệu sinh trắc phải được cảnh báo và ghi nhận;
quy trình xử lý sự cố do tổ chức ban hành trước Phase 10.
