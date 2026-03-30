import { ProjectDetail } from "@/components/project-detail";
import { projects } from "@/lib/data";

export function generateStaticParams() {
  return projects.map((project) => ({ id: project.id }));
}

export default function ProjectPage() {
  return <ProjectDetail />;
}
