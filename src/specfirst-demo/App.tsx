import type { ComponentType } from "react";

type HarnessModule = {
  default: ComponentType;
  routePath?: string;
};

const harnessModules = import.meta.glob<HarnessModule>("./generated/*Harness.tsx", {
  eager: true,
});

export function App() {
  const route = window.location.pathname;
  const match = Object.values(harnessModules).find((module) => module.routePath === route);

  if (!match) {
    return (
      <main data-specfirst-missing-route>
        <h1>SpecFirst harness not found</h1>
        <p>No generated harness is registered for {route}.</p>
      </main>
    );
  }

  const Harness = match.default;
  return <Harness />;
}
