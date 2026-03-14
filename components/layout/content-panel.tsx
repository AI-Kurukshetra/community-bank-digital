import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ContentPanel({
  badge,
  children,
  description,
  title
}: {
  badge?: string;
  children?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        {badge ? <Badge className="w-fit">{badge}</Badge> : null}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
