const SUPABASE_URL = 'https://wmntbxnmeskqmmimirmc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hYomigeIn2H3boEr54Vq2g_j0IVUNWM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- کاربر جاری ---------- */
async function sbCurrentUser() {
  const res = await sb.auth.getUser();
  if (res.error) return null;
  return res.data ? res.data.user : null;
}

/* ---------- حضور و غیاب ---------- */
async function sbLoadAttendance() {
  const res = await sb
    .from('attendance')
    .select('id, started_at, ended_at')
    .order('started_at', { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map(function (r) {
    return {
      id: r.id,
      in: r.started_at,
      out: r.ended_at || null
    };
  });
}

async function sbSaveAttendance(list) {
  const u = await sbCurrentUser();
  if (!u) return;
  await sb.from('attendance').delete().eq('user_id', u.id);
  if (list && list.length > 0) {
    const rows = list.map(function (s) {
      return {
        user_id: u.id,
        started_at: s.in,
        ended_at: s.out || null
      };
    });
    await sb.from('attendance').insert(rows);
  }
}

/* ---------- مرخصی ---------- */
async function sbLoadLeaves() {
  const res = await sb
    .from('leaves')
    .select('*')
    .order('created_at', { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map(function (r) {
    if (r.kind === 'daily') {
      return {
        id: r.id,
        type: 'daily',
        from: r.from_date,
        to: r.to_date,
        days: r.days,
        hours: r.hours,
        note: r.note || ''
      };
    }
    return {
      id: r.id,
      type: 'hourly',
      date: r.single_date,
      start: r.start_time,
      end: r.end_time,
      hours: r.hours,
      note: r.note || ''
    };
  });
}

async function sbSaveLeaves(list) {
  const u = await sbCurrentUser();
  if (!u) return;
  await sb.from('leaves').delete().eq('user_id', u.id);
  if (list && list.length > 0) {
    const rows = list.map(function (rec) {
      if (rec.type === 'daily') {
        return {
          user_id: u.id,
          kind: 'daily',
          from_date: rec.from,
          to_date: rec.to,
          days: rec.days,
          hours: rec.hours,
          note: rec.note || ''
        };
      }
      return {
        user_id: u.id,
        kind: 'hourly',
        single_date: rec.date,
        start_time: rec.start,
        end_time: rec.end,
        hours: rec.hours,
        note: rec.note || ''
      };
    });
    await sb.from('leaves').insert(rows);
  }
}

/* ---------- تعطیلات ---------- */
async function sbLoadHolidays() {
  const res = await sb
    .from('holidays')
    .select('id, holiday_date, title')
    .order('holiday_date', { ascending: true });
  if (res.error || !res.data) return [];
  return res.data.map(function (r) {
    return {
      id: r.id,
      date: r.holiday_date,
      title: r.title || ''
    };
  });
}

async function sbSaveHolidays(list) {
  const u = await sbCurrentUser();
  if (!u) return;
  await sb.from('holidays').delete().eq('user_id', u.id);
  if (list && list.length > 0) {
    const rows = list.map(function (h) {
      return {
        user_id: u.id,
        holiday_date: h.date,
        title: h.title || ''
      };
    });
    await sb.from('holidays').insert(rows);
  }
}

/* ---------- همگام‌سازی: اول از سرور بخوان، اگر خالی بود و کلاینت داده دارد، یک بار آپلود کن ---------- */
async function sbSyncAll() {
  const localAtt = JSON.parse(localStorage.getItem('worklog:attendance') || '[]');
  const remoteAtt = await sbLoadAttendance();
  if (remoteAtt.length === 0 && localAtt.length > 0) {
    await sbSaveAttendance(localAtt);
    const fresh = await sbLoadAttendance();
    localStorage.setItem('worklog:attendance', JSON.stringify(fresh));
  } else {
    localStorage.setItem('worklog:attendance', JSON.stringify(remoteAtt));
  }

  const localLv = JSON.parse(localStorage.getItem('worklog:leave') || '[]');
  const remoteLv = await sbLoadLeaves();
  if (remoteLv.length === 0 && localLv.length > 0) {
    await sbSaveLeaves(localLv);
    const fresh = await sbLoadLeaves();
    localStorage.setItem('worklog:leave', JSON.stringify(fresh));
  } else {
    localStorage.setItem('worklog:leave', JSON.stringify(remoteLv));
  }

  const localHo = JSON.parse(localStorage.getItem('worklog:holidays') || '[]');
  const remoteHo = await sbLoadHolidays();
  if (remoteHo.length === 0 && localHo.length > 0) {
    await sbSaveHolidays(localHo);
    const fresh = await sbLoadHolidays();
    localStorage.setItem('worklog:holidays', JSON.stringify(fresh));
  } else {
    localStorage.setItem('worklog:holidays', JSON.stringify(remoteHo));
  }
}