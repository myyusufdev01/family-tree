from models.member import Member


def render_family_of(member: Member, by_id: dict[str, Member]) -> str:
    """Render direct family view for one person (scalable for large trees)."""
    icon = lambda m: "👨" if m.gender == "male" else "👩"
    fmt = lambda m: f"{icon(m)} {m.name}" + (f" ({m.birth_date})" if m.birth_date else "")

    lines = [f"🌳 *Keluarga: {member.name}*\n"]

    # Grandparents (orang tua dari orang tua)
    grandparents = []
    for pid in member.parent_ids:
        p = by_id.get(pid)
        if p:
            for gid in p.parent_ids:
                g = by_id.get(gid)
                if g and g not in grandparents:
                    grandparents.append(g)
    if grandparents:
        lines.append("👴👵 *Kakek/Nenek:*")
        for g in grandparents:
            lines.append(f"  • {fmt(g)}")
        lines.append("")

    # Parents
    parents = [by_id[pid] for pid in member.parent_ids if pid in by_id]
    if parents:
        lines.append("👨‍👩‍👧 *Orang Tua:*")
        for p in parents:
            lines.append(f"  • {fmt(p)}")
        lines.append("")

    # Siblings (share at least one parent)
    sibling_ids = set()
    for pid in member.parent_ids:
        p = by_id.get(pid)
        if p:
            for cid in p.child_ids:
                if cid != member.id:
                    sibling_ids.add(cid)
    siblings = [by_id[sid] for sid in sibling_ids if sid in by_id]
    if siblings:
        lines.append("👫 *Saudara:*")
        for s in siblings:
            lines.append(f"  • {fmt(s)}")
        lines.append("")

    # Self
    self_label = fmt(member)
    lines.append(f"👤 *{self_label}* ← (Anda cari)")

    # Spouses
    spouses = [by_id[sid] for sid in member.spouse_ids if sid in by_id]
    if spouses:
        lines.append("")
        lines.append("💑 *Pasangan:*")
        for sp in spouses:
            lines.append(f"  • {fmt(sp)}")

    # Children
    children = [by_id[cid] for cid in member.child_ids if cid in by_id]
    if children:
        lines.append("")
        lines.append("👶 *Anak:*")
        for c in children:
            # also show grandchildren count
            gc_count = len([gid for gid in c.child_ids if gid in by_id])
            line = f"  • {fmt(c)}"
            if gc_count:
                line += f"  _(punya {gc_count} anak)_"
            lines.append(line)

    return "\n".join(lines)


def render_member_relations(member: Member, all_members: list[Member]) -> str:
    by_id = {m.id: m for m in all_members}
    return render_family_of(member, by_id)
