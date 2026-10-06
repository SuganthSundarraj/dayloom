"use client";
import { useEffect, useId, useRef, useState } from "react";

type Format = "minutes" | "hours" | "mixed";
export default function DurationField({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const [format, setFormat] = useState<Format>("minutes");
  const [amount, setAmount] = useState(String(minutes));
  const [remainder, setRemainder] = useState("0");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const message = !Number.isFinite(minutes)
    ? ""
    : !Number.isInteger(minutes)
      ? "Use a duration in whole minutes, such as 1.5 hours."
      : minutes < 5 || minutes > 480
        ? "Choose a duration between 5 minutes and 8 hours."
        : "";
  useEffect(() => {
    input.current?.setCustomValidity(message);
  }, [message]);
  function update(value: string, remaining: string) {
    setAmount(value);
    setRemainder(remaining);
    if (!value || (format === "mixed" && !remaining)) {
      onChange(Number.NaN);
      return;
    }
    const total =
      format === "minutes"
        ? Number(value)
        : Number(value) * 60 + (format === "mixed" ? Number(remaining) : 0);
    // Decimal-hour floating point noise must not turn a whole minute into a fractional one.
    const rounded = Math.round(total);
    onChange(Math.abs(total - rounded) < 0.000001 ? rounded : total);
  }
  function changeFormat(next: Format) {
    setFormat(next);
    if (!Number.isFinite(minutes)) {
      setAmount("");
      setRemainder("0");
      return;
    }
    setAmount(
      next === "minutes"
        ? String(minutes)
        : next === "hours"
          ? String(Number((minutes / 60).toFixed(8)))
          : String(Math.floor(minutes / 60)),
    );
    setRemainder(String(minutes % 60));
  }
  return (
    <fieldset className="duration-field">
      <legend>Estimated duration</legend>
      <div className="duration-controls">
        <div
          className={
            format === "mixed" ? "duration-amounts mixed" : "duration-amounts"
          }
        >
          <label>
            {format === "minutes"
              ? "Duration (minutes)"
              : format === "hours"
                ? "Duration (hours)"
                : "Hours"}
            <input
              ref={input}
              type="number"
              inputMode={format === "hours" ? "decimal" : "numeric"}
              required
              min={format === "minutes" ? 5 : 0}
              max={format === "minutes" ? 480 : 8}
              step={format === "hours" ? "any" : 1}
              value={amount}
              aria-describedby={`${id}-help`}
              onChange={(event) => update(event.target.value, remainder)}
            />
          </label>
          {format === "mixed" && (
            <label>
              Minutes
              <input
                type="number"
                inputMode="numeric"
                required
                min={0}
                max={59}
                step={1}
                value={remainder}
                aria-describedby={`${id}-help`}
                onChange={(event) => update(amount, event.target.value)}
              />
            </label>
          )}
        </div>
        <label>
          Duration format
          <select
            value={format}
            onChange={(event) => changeFormat(event.target.value as Format)}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="mixed">Hours & minutes</option>
          </select>
        </label>
      </div>
      <p id={`${id}-help`} className="form-help">
        5 minutes to 8 hours.
        {format === "hours" && " Use 1.5 for an hour and a half."}
        {Number.isFinite(minutes) && !message && ` ${minutes} minutes total.`}
      </p>
    </fieldset>
  );
}
