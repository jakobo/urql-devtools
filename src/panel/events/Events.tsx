import React, {
  useContext,
  useReducer,
  Reducer,
  ReactNode,
  useEffect,
  useState
} from "react";
import styled, { css } from "styled-components";
import { EventCard } from "./EventCard";
import { Panel } from "./panels";
import { EventsContext } from "../context";
import { Background } from "../components/Background";
import { UrqlEvent } from "../../types";

enum FilterType {
  Name = "name",
  Key = "key",
  Info = "info"
}
interface Filter {
  value: string;
  propName: FilterType;
  propGetter: any;
}

enum FilterActionType {
  Add = "add",
  Remove = "remove"
}

interface FilterState {
  filters: Filter[];
  filteredEvents: any[];
}

interface FilterAction {
  type: FilterActionType;
  payload: {
    filter: Filter;
  };
}

function initialState(initialEvents: any[]): FilterState {
  return {
    filters: [],
    filteredEvents: initialEvents
  };
}

function filterEvents(events: UrqlEvent[], filters: Filter[]) {
  return events.filter(event => {
    return filters.every(f => f.propGetter(event) === f.value);
  });
}

function filterFilters(filters: Filter[], incomingFilter: Filter) {
  return filters.filter(
    f =>
      f.value !== incomingFilter.value && f.propName !== incomingFilter.propName
  );
}

export const Events = () => {
  const { events, selectedEvent } = useContext(EventsContext);

  const reducer: Reducer<FilterState, FilterAction> = (state, action) => {
    switch (action.type) {
      case FilterActionType.Add: {
        const newFilter = action.payload.filter;
        const newFilters = [
          action.payload.filter,
          ...filterFilters(state.filters, newFilter)
        ];

        return {
          filteredEvents: filterEvents(events, newFilters),
          filters: newFilters
        };
      }

      case FilterActionType.Remove: {
        const oldFilter = action.payload.filter;
        const newFilters = filterFilters(state.filters, oldFilter);

        const newEvents = newFilters.length
          ? events.filter(event => {
              return newFilters.every(f => f.propGetter(event) === f.value);
            })
          : events;

        return {
          filteredEvents: newEvents,
          filters: newFilters
        };
      }
      default: {
        return state;
      }
    }
  };

  const [state, dispatch] = useReducer<Reducer<FilterState, FilterAction>>(
    reducer,
    initialState(events)
  );

  const [pressed, setPressed] = useState(false);

  /* TODO: this maps to the command key currently
  but the keycode might not match on non-webkit browsers */

  const handleKeydown = (e: KeyboardEvent) => setPressed(e.keyCode === 91);
  const handleKeyUp = () => setPressed(false);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyUp);

    () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const { filters, filteredEvents } = state;

  return (
    <Container>
      <FiltersContainer>
        {filters.map(
          (filter: Filter, i: number): ReactNode => (
            <FilterButton
              key={i}
              buttonType={filter.propName}
              onClick={() =>
                dispatch({
                  type: FilterActionType.Remove,
                  payload: { filter }
                })
              }
            >
              <span>{`${filter.propName}:${filter.value}`}</span>
            </FilterButton>
          )
        )}
      </FiltersContainer>
      <EventsList>
        {filteredEvents.map((op: any, i: any) => (
          <EventCard
            key={i}
            operation={op}
            setFilter={dispatch}
            canFilter={pressed}
            active={op === selectedEvent}
          />
        ))}
      </EventsList>
      <Panel />
    </Container>
  );
};

interface FilterButtonProps {
  buttonType: FilterType;
}

const Container = styled(Background)`
  @media (min-aspect-ratio: 1/1) {
    & > * {
      width: 50%;
    }

    & > *:nth-child(2) {
      height: unset;
      max-height: unset;
    }
  }
`;

const FiltersContainer = styled.div`
  display: flex;
  margin: 0 5px;
`;

const getButtonColor = (type: FilterType) => {
  switch (type) {
    case FilterType.Key: {
      return css`
        background-color: #fcfaa7;
      `;
    }
    case FilterType.Info: {
      return css`
        background-color: #c7f0d2;
      `;
    }

    case FilterType.Name: {
      return css`
        background-color: #b8dbf2;
      `;
    }

    default: {
      return css`
        background-color: white;
      `;
    }
  }
};

const FilterButton = styled.button`
  display: inline-block;
  border: none;
  margin: 5px 0px 5px 5px;
  font-family: "Dank Mono", monospace;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: center;

  &:last-of-type {
    margin-right: 0;
  }

  ${(p: FilterButtonProps) => getButtonColor(p.buttonType)};
`;

const EventsList = styled.div`
  overflow: scroll;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-basis: 0;
  flex-grow: 1;
`;
