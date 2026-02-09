"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = { id: string; project_code: string; name: string };
type Stage = { id: string; name: string; sort_order: number };
type UpdateRow = {
  project_id: string;
  stage_id: string;
  plan_date: string | null;
  actual_date: string | null;
  approve_date: string | null;
};

function getStyle(plan?: string | null, actual?: string | null, approve?: string | null) {
  const today = new Date();
  const planD = plan ? new Date(plan) : null;

  // 🟦 승인완료
  if (approve) return { background: "#5b8bd1", color: "white" };

  // 🟥 지체(계획일 지났는데 실적 없음)
  if (planD && planD < today && !actual) return { background: "#ff4d4f", color: "white" };

  // 🟨 미승인(실적은 있는데 승인 없음)
  if (actual && !approve) return { background: "#ffe66b" };

  return {};
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);

  useEffect(() => {
    (async () => {
      const p = await supabase.from("projects").select("id, project_code, name").order("project_code");
      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
      const u = await supabase
        .from("stage_updates")
        .select("project_id, stage_id, plan_date, actual_date, approve_date");

      setProjects(p.data ?? []);
      setStages(s.data ?? []);
      setUpdates(u.data ?? []);
    })();
  }, []);

  // project_id -> (stage_id -> row)
  const map = useMemo(() => {
    const m = new Map<string, Map<string, UpdateRow>>();
    for (const u of updates) {
      if (!m.has(u.project_id)) m.set(u.project_id, new Map());
      m.get(u.project_id)!.set(u.stage_id, u);
    }
    return m;
  }, [updates]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>대시보드 (프로젝트 단계 현황)</h2>

      {/* 범례 */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ padding: "4px 8px", background: "#ffe66b", borderRadius: 4 }}>미승인</span>
        <span style={{ padding: "4px 8px", background: "#5b8bd1", color: "white", borderRadius: 4 }}>
          승인완료
        </span>
        <span style={{ padding: "4px 8px", background: "#ff4d4f", color: "white", borderRadius: 4 }}>지체</span>
        <a href="/input" style={{ marginLeft: 12 }}>입력화면으로 이동</a>
      </div>

      {/* 스크롤 컨테이너 */}
      <div style={{ overflowX: "auto", border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
          <thead>
            {/* 1행: 단계 제목(각 단계 3칸 묶기) */}
            <tr>
              <th style={thStickyLeft(0, 120)}>프로젝트코드</th>
              <th style={thStickyLeft(120, 220)}>프로젝트명</th>

              {stages.map((s) => (
                <th key={s.id} colSpan={3} style={thStageGroup}>
                  {s.id}. {s.name}
                </th>
              ))}
            </tr>

            {/* 2행: 계획/실적/승인 */}
            <tr>
              <th style={thStickyLeft(0, 120)} />
              <th style={thStickyLeft(120, 220)} />

              {stages.map((s) => (
                <Fragment3 key={s.id} />
              ))}
            </tr>
          </thead>

          <tbody>
  {projects.map((p) => {
    const sm = map.get(p.id) ?? new Map<string, UpdateRow>();

    return (
      <tr key={p.id}>
        <td style={tdStickyLeft(0, 120)}>{p.project_code}</td>
        <td style={tdStickyLeft(120, 220)}>{p.name}</td>

        {stages.map((s) => {
          const r = sm.get(s.id);
          const style = getStyle(r?.plan_date, r?.actual_date, r?.approve_date);

          return (
            <React.Fragment key={s.id}>
              <td style={{ ...tdCell, ...style }}>{r?.plan_date ?? ""}</td>
              <td style={{ ...tdCell, ...style }}>{r?.actual_date ?? ""}</td>
              <td style={{ ...tdCell, ...style }}>{r?.approve_date ?? ""}</td>
            </React.Fragment>
          );
        })}
      </tr>
    );
  })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, color: "#666" }}>
        * 가로 스크롤로 전체 단계를 확인할 수 있습니다. (헤더/왼쪽 2열 고정)
      </p>
    </div>
  );
}

function renderTdGroup3(
  keyBase: string,
  style: React.CSSProperties,
  plan?: string | null,
  actual?: string | null,
  approve?: string | null
) {
  return (
    <>
      <td key={`${keyBase}-p`} style={{ ...tdCell, ...style }}>{plan ?? ""}</td>
      <td key={`${keyBase}-a`} style={{ ...tdCell, ...style }}>{actual ?? ""}</td>
      <td key={`${keyBase}-v`} style={{ ...tdCell, ...style }}>{approve ?? ""}</td>
    </>
  );
}



/** ✅ 헤더 2행에서 3개 th를 정확히 반환 (span 사용 금지!) */
function Fragment3() {
  return (
    <>
      <th style={thSub}>계획</th>
      <th style={thSub}>실적</th>
      <th style={thSub}>승인</th>
    </>
  );
}

/** ✅ 각 단계(3칸) 출력 */
function tdGroup3({
  style,
  plan,
  actual,
  approve,
}: {
  style: React.CSSProperties;
  plan?: string | null;
  actual?: string | null;
  approve?: string | null;
}) {
  return (
    <>
      <td style={{ ...tdCell, ...style }}>{plan ?? ""}</td>
      <td style={{ ...tdCell, ...style }}>{actual ?? ""}</td>
      <td style={{ ...tdCell, ...style }}>{approve ?? ""}</td>
    </>
  );
}

/** 스타일들 */
const border = "1px solid #bbb";

const thStageGroup: React.CSSProperties = {
  border,
  padding: "8px 10px",
  background: "#f2f2f2",
  textAlign: "center",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

const thSub: React.CSSProperties = {
  border,
  padding: "6px 8px",
  background: "#fafafa",
  textAlign: "center",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 42, // 1행 헤더 높이만큼 아래
  zIndex: 2,
};

const tdCell: React.CSSProperties = {
  border,
  padding: "6px 8px",
  textAlign: "center",
  whiteSpace: "nowrap",
  minWidth: 90,
};

function thStickyLeft(leftPx: number, width: number): React.CSSProperties {
  return {
    border,
    padding: "8px 10px",
    background: "#f2f2f2",
    textAlign: "center",
    position: "sticky",
    left: leftPx,
    zIndex: 5,
    width,
    minWidth: width,
    maxWidth: width,
    whiteSpace: "nowrap",
    top: 0,
  };
}

function tdStickyLeft(leftPx: number, width: number): React.CSSProperties {
  return {
    border,
    padding: "6px 8px",
    background: "white",
    position: "sticky",
    left: leftPx,
    zIndex: 3,
    width,
    minWidth: width,
    maxWidth: width,
    whiteSpace: "nowrap",
  };
}
