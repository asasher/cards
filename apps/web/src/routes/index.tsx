import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { kvInputSchema } from "@/lib/api/types";
import { kvListQueryOptions } from "@/lib/api/query-options";
import {
  createKvMutationOptions,
  deleteKvMutationOptions,
  updateKvMutationOptions,
} from "@/lib/api/mutation-options";
import type { KvItem } from "@/lib/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const queryClient = useQueryClient();
  const isClient = typeof window !== "undefined";

  const kvQuery = useQuery(kvListQueryOptions(isClient));

  const createMutation = useMutation(createKvMutationOptions(queryClient));
  const updateMutation = useMutation(updateKvMutationOptions(queryClient));
  const deleteMutation = useMutation(deleteKvMutationOptions(queryClient));

  const items = React.useMemo(() => kvQuery.data ?? [], [kvQuery.data]);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [draftKey, setDraftKey] = React.useState("");

  const form = useForm({
    defaultValues: {
      key: "",
      value: "",
    },
    onSubmit: async ({ value }) => {
      const parsed = kvInputSchema.safeParse(value);

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message ?? "Please fix the form fields.";
        setSubmitError(firstIssue);
        return;
      }

      setSubmitError(null);

      const entryExists = items.some((item) => item.key === parsed.data.key);

      if (entryExists) {
        await updateMutation.mutateAsync(parsed.data);
      } else {
        await createMutation.mutateAsync(parsed.data);
      }

      form.reset();
      setDraftKey("");
    },
  });

  const columns = React.useMemo<ColumnDef<KvItem>[]>(
    () => [
      {
        accessorKey: "key",
        header: "Key",
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => <span className="line-clamp-2 break-all text-foreground/85">{row.original.value}</span>,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                deleteMutation.mutate(row.original.key);
              }}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [deleteMutation],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 58,
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  });

  const keyAlreadyExists = items.some((item) => item.key === draftKey.trim());

  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Key-Value Console</CardTitle>
          <CardDescription>
            TanStack Start + Elysia + Eden + Drizzle with optimistic query mutations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="key">
              {(field) => (
                <Input
                  placeholder="key"
                  value={field.state.value}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    field.handleChange(nextValue);
                    setDraftKey(nextValue);
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              )}
            </form.Field>
            <form.Field name="value">
              {(field) => (
                <Input
                  placeholder="value"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              )}
            </form.Field>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {keyAlreadyExists ? "Update" : "Create"}
            </Button>
          </form>
          {submitError ? <p className="mt-2 text-sm text-danger">{submitError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Records ({items.length})</CardTitle>
          <CardDescription>
            Query list + table rendering + row virtualization for larger datasets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kvQuery.isPending ? <p className="text-foreground/70">Loading records...</p> : null}

          {kvQuery.isError ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 bg-danger/10 p-4">
              <p className="text-sm text-danger">Failed to load records.</p>
              <Button variant="outline" onClick={() => kvQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!kvQuery.isPending && !kvQuery.isError && items.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground/70">
              No data yet. Add a key-value pair above.
            </p>
          ) : null}

          {!kvQuery.isPending && !kvQuery.isError && items.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-surface-muted/60 hover:bg-surface-muted/60">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
              </Table>

              <div ref={tableContainerRef} className="h-[420px] overflow-auto bg-surface">
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  <Table>
                    <TableBody>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];

                        return (
                          <TableRow
                            key={row.id}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualRow.start}px)`,
                              display: "table",
                              tableLayout: "fixed",
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
