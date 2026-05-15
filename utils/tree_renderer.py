from models.member import Member


def render_tree(members: list[Member]) -> str:
    if not members:
        return "Pohon keluarga masih kosong."

    by_id = {m.id: m for m in members}

    # Find roots: members with no parents in this tree
    roots = [m for m in members if not any(pid in by_id for pid in m.parent_ids)]

    visited = set()
    lines = []

    def render_member(member: Member, prefix: str, is_last: bool):
        if member.id in visited:
            return
        visited.add(member.id)

        connector = "└── " if is_last else "├── "
        gender_icon = "👨" if member.gender == "male" else "👩"
        label = f"{gender_icon} {member.name}"
        if member.birth_date:
            label += f" ({member.birth_date})"

        lines.append(prefix + connector + label)

        # Show spouses inline
        for sp_id in member.spouse_ids:
            sp = by_id.get(sp_id)
            if sp and sp.id not in visited:
                sp_icon = "👨" if sp.gender == "male" else "👩"
                lines.append(prefix + ("    " if is_last else "│   ") + f"  💑 {sp_icon} {sp.name}")
                visited.add(sp.id)

        child_prefix = prefix + ("    " if is_last else "│   ")
        children = [by_id[cid] for cid in member.child_ids if cid in by_id]
        for i, child in enumerate(children):
            render_member(child, child_prefix, i == len(children) - 1)

    lines.append("🌳 *Pohon Keluarga*")
    for i, root in enumerate(roots):
        render_member(root, "", i == len(roots) - 1)

    return "\n".join(lines)


def render_member_relations(member: Member, all_members: list[Member]) -> str:
    by_id = {m.id: m for m in all_members}
    lines = [member.summary(), ""]

    parents = [by_id[pid].name for pid in member.parent_ids if pid in by_id]
    spouses = [by_id[sid].name for sid in member.spouse_ids if sid in by_id]
    children = [by_id[cid].name for cid in member.child_ids if cid in by_id]

    if parents:
        lines.append(f"👪 Orang tua: {', '.join(parents)}")
    if spouses:
        lines.append(f"💑 Pasangan: {', '.join(spouses)}")
    if children:
        lines.append(f"👶 Anak: {', '.join(children)}")

    return "\n".join(lines)
