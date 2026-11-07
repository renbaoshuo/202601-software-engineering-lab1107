import { Center, Loader } from "@mantine/core";
import { useLiveQuery } from "dexie-react-hooks";
import { transactions } from "../shared/db";
import CategoryChart from "./CategoryChart";

export default function CategoryAnalysis() {
  const records = useLiveQuery(() => transactions.list({ type: "expense" }));

  if (records === undefined) {
    return (
      <Center py="xl">
        <Loader aria-label="正在读取账单" />
      </Center>
    );
  }

  return <CategoryChart records={records} />;
}
