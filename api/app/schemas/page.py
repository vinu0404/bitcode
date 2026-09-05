from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int  # total rows matching the filter, independent of this page's size
    limit: int
    offset: int
