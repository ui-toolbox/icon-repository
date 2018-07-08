import { List } from "immutable";

const csvSplitter: (list: string) => List<string>
= list => List(list.split(/[\s]*,[\s]*/).map(format => format.trim()));

export default csvSplitter;
