import stringify from "fast-json-stable-stringify";
import nanoid from "nanoid";
import { Operation } from "urql";

import {
  Scalar,
  SelectionSet,
  Variables,
  ResolveInfo,
  NullArray
} from "./types";

import {
  getName,
  getSelectionSet,
  isFieldNode,
  isInlineFragment,
  getFieldAlias
} from "./node";

import { getFieldArguments, normalizeVariables } from "./variables";

import { getMainOperation, getFragments } from "./traversal";

type DataField = Scalar | NullArray<Scalar> | null;

export interface FieldNode {
  _id: string;
  _owner: {};
  key: string;
  name: string;
  args: Variables | null;
  value?: DataField;
  children?: NodeMap | NullArray<NodeMap>;
}

export interface NodeMap {
  [key: string]: FieldNode;
}

interface Data {
  [fieldName: string]: Data[] | Data | DataField;
}

export const keyOfField = (fieldName: string, args?: null | Variables) =>
  args ? `${fieldName}(${stringify(args)})` : fieldName;

export const startQuery = (
  request: Operation,
  data: Data,
  map: NodeMap = Object.create(null)
) => {
  if (request.operationName !== "query") {
    return map;
  }

  const operation = getMainOperation(request.query);
  const select = getSelectionSet(operation);

  if (select.length === 0) {
    return map;
  }

  const ctx = {
    variables: normalizeVariables(operation, request.variables),
    fragments: getFragments(request.query)
  };

  const owner = {};
  return copyFromData(ctx, copyNodeMap(map), select, data, owner);
};

const copyNodeMap = (map: null | NodeMap): NodeMap => {
  const newMap = Object.create(null);
  return map !== null ? Object.assign(newMap, map) : newMap;
};

const copyFieldNode = (node: FieldNode, owner: {}) => {
  if (node._owner === owner) {
    return node;
  } else {
    const newNode = {
      ...node,
      _owner: owner
    };

    if (Array.isArray(node.children)) {
      newNode.children = node.children.map(copyNodeMap);
    } else if (typeof node.children === "object") {
      newNode.children = copyNodeMap(node.children);
    }

    return newNode;
  }
};

function copyFromData(
  ctx: ResolveInfo,
  map: NodeMap,
  selection: SelectionSet,
  data: Data,
  owner: {}
) {
  selection.forEach(fieldNode => {
    if (isFieldNode(fieldNode)) {
      const fieldName = getName(fieldNode) || "query";
      const fieldArgs = getFieldArguments(fieldNode, ctx.variables);
      const fieldKey = keyOfField(fieldName, fieldArgs);
      const fieldValue = data[getFieldAlias(fieldNode)];

      let node: FieldNode;
      if (map[fieldKey] === undefined) {
        node = map[fieldKey] = {
          _id: nanoid(),
          _owner: owner,
          key: fieldKey,
          name: fieldName,
          args: fieldArgs
        };
      } else {
        node = copyFieldNode(map[fieldKey], owner);
      }

      if (
        fieldNode.selectionSet !== undefined &&
        typeof fieldValue === "object" &&
        fieldValue !== null
      ) {
        const childValue = fieldValue as Data | Data[];
        const fieldSelection = getSelectionSet(fieldNode);

        if (Array.isArray(childValue)) {
          const size = childValue.length;
          node.children = Array.isArray(node.children)
            ? node.children
            : new Array(size);
          node.children.length = size;

          for (let i = 0; i < size; i++) {
            const childData: Data | null = childValue[i];
            if (childData === null) {
              node.children[i] = null;
            } else {
              const childMap = node.children[i] || Object.create(null);
              node.children[i] = copyFromData(
                ctx,
                childMap,
                fieldSelection,
                childData,
                owner
              );
            }
          }
        } else {
          const childMap = node.children || Object.create(null);
          node.children = copyFromData(
            ctx,
            childMap,
            fieldSelection,
            childValue,
            owner
          );
        }

        delete node.value;
      } else {
        node.value = fieldValue === undefined ? null : fieldValue;
        delete node.children;
      }
    } else {
      const fragmentNode = !isInlineFragment(fieldNode)
        ? ctx.fragments[getName(fieldNode)]
        : fieldNode;
      if (fragmentNode !== undefined) {
        copyFromData(ctx, map, getSelectionSet(fragmentNode), data, owner);
      }
    }
  });

  return map;
}
