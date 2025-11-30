from sqlmodel import SQLModel, Field
from typing import Optional

class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    height_cm: Optional[int]
    weight_kg: Optional[int]
    goal: Optional[str]
    activity_level: Optional[str]
    food_preference: Optional[str]
