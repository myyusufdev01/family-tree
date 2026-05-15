from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class Member:
    id: str
    name: str
    gender: str  # "male" | "female"
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    parent_ids: list = field(default_factory=list)
    spouse_ids: list = field(default_factory=list)
    child_ids: list = field(default_factory=list)
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "name_lower": self.name.lower(),  # for Firestore prefix search
            "gender": self.gender,
            "birth_date": self.birth_date,
            "death_date": self.death_date,
            "phone": self.phone,
            "notes": self.notes,
            "parent_ids": self.parent_ids,
            "spouse_ids": self.spouse_ids,
            "child_ids": self.child_ids,
            "created_at": self.created_at or datetime.utcnow().isoformat(),
        }

    @staticmethod
    def from_dict(data: dict) -> "Member":
        return Member(
            id=data["id"],
            name=data["name"],
            gender=data.get("gender", "male"),
            birth_date=data.get("birth_date"),
            death_date=data.get("death_date"),
            phone=data.get("phone"),
            notes=data.get("notes"),
            parent_ids=data.get("parent_ids", []),
            spouse_ids=data.get("spouse_ids", []),
            child_ids=data.get("child_ids", []),
            created_at=data.get("created_at"),
        )

    def summary(self) -> str:
        lines = [f"👤 *{self.name}*"]
        gender_label = "Laki-laki" if self.gender == "male" else "Perempuan"
        lines.append(f"Jenis Kelamin: {gender_label}")
        if self.birth_date:
            lines.append(f"Lahir: {self.birth_date}")
        if self.death_date:
            lines.append(f"Wafat: {self.death_date}")
        if self.phone:
            lines.append(f"Telepon: {self.phone}")
        if self.notes:
            lines.append(f"Catatan: {self.notes}")
        return "\n".join(lines)
