import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "email/password required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1) 유저 생성 (신규 가입 1회 이벤트)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 인증 흐름을 쓰지 않을 거면 true로
      user_metadata: { full_name },
    });

    if (error) {
      // 동일 이메일 재가입 시 여기서 막히며, 그 경우 메일도 재발송되지 않음
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    const userId = data.user.id;

    // 2) profiles 이름 업데이트(트리거가 만드는 경우 대비)
    await supabaseAdmin
      .from("profiles")
      .update({ full_name })
      .eq("id", userId);

    // 3) 승인요청 메일 발송 (회원가입 시 1회만)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT!),
      secure: false,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });

    const adminEmail = process.env.ADMIN_APPROVAL_EMAIL!;
    const approveLink = `${process.env.APP_BASE_URL}/admin/approvals`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM!,
      to: adminEmail,
      subject: `[승인요청] Project Monitor 입력 계정 승인 필요: ${email}`,
      html: `
        <p>신규 회원가입 승인 요청이 접수되었습니다.</p>
        <ul>
          <li><b>Email</b>: ${email}</li>
          <li><b>Name</b>: ${full_name ?? "-"}</li>
          <li><b>User ID</b>: ${userId}</li>
        </ul>
        <p>승인 처리 페이지: <a href="${approveLink}">${approveLink}</a></p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? "server error" }, { status: 500 });
  }
}
