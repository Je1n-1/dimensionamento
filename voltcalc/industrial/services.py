"""Separate future service ports. No implementations or fallback to 1997."""
from typing import Protocol, TypedDict


class CalculationRequest(TypedDict):
    projectId: str
    inputRevision: int
    domain: str
    engineVersion: str
    rulesVersion: str


class ConductorService(Protocol):
    def calculate(self, request: CalculationRequest, project: dict) -> dict:
        """Return conductor criteria only; never assert protection compliance."""
        ...


class ProtectionService(Protocol):
    def verify(self, request: CalculationRequest, project: dict) -> dict:
        """Future protection evaluation, independent from conductor selection."""
        ...
