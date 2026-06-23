/**
 * Typed account-status sub-objects: {@link Permissions}, {@link Plus} and the
 * {@link Subscription} tree (products, auto-renewables, operators).
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { User } from '../user.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** The set of permissions granted to the account. */
export class Permissions extends YandexMusicModel {
  /** Date until which the permissions are valid. */
  until?: string;
  /** Currently granted permission values. */
  values?: string[];
  /** Default permission values. */
  default?: string[];

  /** @see {@link Permissions} */
  static deJson(raw: JSONValue | undefined, client?: Client): Permissions | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Permissions(client);
    assign(model, raw, ['until', 'values', 'default']);
    reportUnknown(client, 'Permissions', raw, model);
    return model;
  }
}

/** Yandex Plus status of the account. */
export class Plus extends YandexMusicModel {
  /** Whether the account has Plus. */
  hasPlus?: boolean;
  /** Whether the onboarding tutorial is completed. */
  isTutorialCompleted?: boolean;
  /** Whether the account was migrated to the current Plus subscription. */
  migrated?: boolean;

  /** @see {@link Plus} */
  static deJson(raw: JSONValue | undefined, client?: Client): Plus | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Plus(client);
    assign(model, raw, ['hasPlus', 'isTutorialCompleted', 'migrated']);
    reportUnknown(client, 'Plus', raw, model);
    return model;
  }
}

/** A monetary amount in a given currency. */
export class Price extends YandexMusicModel {
  /** Amount (in the currency's minor units, per the API). */
  amount?: number;
  /** Currency code. */
  currency?: string;

  /** @see {@link Price} */
  static deJson(raw: JSONValue | undefined, client?: Client): Price | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Price(client);
    assign(model, raw, ['amount', 'currency']);
    reportUnknown(client, 'Price', raw, model);
    return model;
  }
}

/** A single part of a product's licence text (optionally a link). */
export class LicenceTextPart extends YandexMusicModel {
  /** Text fragment. */
  text?: string;
  /** Link target, when the fragment is a link. */
  url?: string;

  /** @see {@link LicenceTextPart} */
  static deJson(raw: JSONValue | undefined, client?: Client): LicenceTextPart | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LicenceTextPart(client);
    assign(model, raw, ['text', 'url']);
    reportUnknown(client, 'LicenceTextPart', raw, model);
    return model;
  }
}

/** A purchasable subscription product. */
export class Product extends YandexMusicModel {
  /** Product id. */
  productId?: string;
  /** Product type. */
  type?: string;
  /** Subscription duration. */
  duration?: number;
  /** Trial duration. */
  trialDuration?: number;
  /** Feature key. */
  feature?: string;
  /** Whether this is a debug product. */
  debug?: boolean;
  /** Whether the product includes Plus. */
  plus?: boolean;
  /** Recurring price. */
  price?: Price;
  /** Common period duration. */
  commonPeriodDuration?: string;
  /** Whether this is the cheapest product. */
  cheapest?: boolean;
  /** Display title. */
  title?: string;
  /** Whether this is a family subscription. */
  familySub?: boolean;
  /** Facebook share image. */
  fbImage?: string;
  /** Facebook share name. */
  fbName?: string;
  /** Whether the product is a family plan. */
  family?: boolean;
  /** Feature keys. */
  features?: string[];
  /** Description. */
  description?: string;
  /** Whether the product is available. */
  available?: boolean;
  /** Whether a trial is available. */
  trialAvailable?: boolean;
  /** Trial period duration. */
  trialPeriodDuration?: string;
  /** Intro period duration. */
  introPeriodDuration?: string;
  /** Intro price. */
  introPrice?: Price;
  /** Start period duration. */
  startPeriodDuration?: string;
  /** Start price. */
  startPrice?: Price;
  /** Licence text parts. */
  licenceTextParts?: LicenceTextPart[];
  /** Whether a vendor trial is available. */
  vendorTrialAvailable?: boolean;
  /** Call-to-action button text. */
  buttonText?: string;
  /** Additional button text. */
  buttonAdditionalText?: string;
  /** Accepted payment-method types. */
  paymentMethodTypes?: string[];

  /** @see {@link Product} */
  static deJson(raw: JSONValue | undefined, client?: Client): Product | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Product(client);
    assign(model, raw, [
      'productId',
      'type',
      'duration',
      'trialDuration',
      'feature',
      'debug',
      'plus',
      'commonPeriodDuration',
      'cheapest',
      'title',
      'familySub',
      'fbImage',
      'fbName',
      'family',
      'features',
      'description',
      'available',
      'trialAvailable',
      'trialPeriodDuration',
      'introPeriodDuration',
      'startPeriodDuration',
      'vendorTrialAvailable',
      'buttonText',
      'buttonAdditionalText',
      'paymentMethodTypes',
    ]);
    model.price = Price.deJson(raw['price'], client) ?? undefined;
    model.introPrice = Price.deJson(raw['introPrice'], client) ?? undefined;
    model.startPrice = Price.deJson(raw['startPrice'], client) ?? undefined;
    model.licenceTextParts = deList(LicenceTextPart.deJson, raw['licenceTextParts'], client);
    reportUnknown(client, 'Product', raw, model);
    return model;
  }
}

/** An auto-renewing subscription. */
export class AutoRenewable extends YandexMusicModel {
  /** Expiry timestamp. */
  expires?: string;
  /** Vendor name. */
  vendor?: string;
  /** Vendor help URL. */
  vendorHelpUrl?: string;
  /** The subscribed product. */
  product?: Product;
  /** Whether the subscription has finished. */
  finished?: boolean;
  /** Owner of a shared (family) subscription. */
  masterInfo?: User;
  /** Product id. */
  productId?: string;
  /** Order id. */
  orderId?: number;

  /** @see {@link AutoRenewable} */
  static deJson(raw: JSONValue | undefined, client?: Client): AutoRenewable | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AutoRenewable(client);
    assign(model, raw, ['expires', 'vendor', 'vendorHelpUrl', 'finished', 'productId', 'orderId']);
    model.product = Product.deJson(raw['product'], client) ?? undefined;
    model.masterInfo = User.deJson(raw['masterInfo'], client) ?? undefined;
    reportUnknown(client, 'AutoRenewable', raw, model);
    return model;
  }
}

/** A non-auto-renewing subscription window. */
export class NonAutoRenewable extends YandexMusicModel {
  /** Start timestamp. */
  start?: string;
  /** End timestamp. */
  end?: string;

  /** @see {@link NonAutoRenewable} */
  static deJson(raw: JSONValue | undefined, client?: Client): NonAutoRenewable | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new NonAutoRenewable(client);
    assign(model, raw, ['start', 'end']);
    reportUnknown(client, 'NonAutoRenewable', raw, model);
    return model;
  }
}

/** The remaining days of a non-auto-renewing subscription. */
export class RenewableRemainder extends YandexMusicModel {
  /** Days remaining. */
  days?: number;

  /** @see {@link RenewableRemainder} */
  static deJson(raw: JSONValue | undefined, client?: Client): RenewableRemainder | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RenewableRemainder(client);
    assign(model, raw, ['days']);
    reportUnknown(client, 'RenewableRemainder', raw, model);
    return model;
  }
}

/** Instructions for deactivating an operator subscription. */
export class Deactivation extends YandexMusicModel {
  /** Deactivation method (known value: `ussd`). */
  method?: string;
  /** Human-readable instructions. */
  instructions?: string;

  /** @see {@link Deactivation} */
  static deJson(raw: JSONValue | undefined, client?: Client): Deactivation | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Deactivation(client);
    assign(model, raw, ['method', 'instructions']);
    reportUnknown(client, 'Deactivation', raw, model);
    return model;
  }
}

/** A mobile-operator-billed subscription. */
export class Operator extends YandexMusicModel {
  /** Product id. */
  productId?: string;
  /** Billed phone number. */
  phone?: string;
  /** Payment regularity. */
  paymentRegularity?: string;
  /** Deactivation options. */
  deactivation?: Deactivation[];
  /** Display title. */
  title?: string;
  /** Whether the subscription is suspended. */
  suspended?: boolean;

  /** @see {@link Operator} */
  static deJson(raw: JSONValue | undefined, client?: Client): Operator | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Operator(client);
    assign(model, raw, ['productId', 'phone', 'paymentRegularity', 'title', 'suspended']);
    model.deactivation = deList(Deactivation.deJson, raw['deactivation'], client);
    reportUnknown(client, 'Operator', raw, model);
    return model;
  }
}

/** The account's subscription state. */
export class Subscription extends YandexMusicModel {
  /** Remaining days of the non-auto-renewing subscription. */
  nonAutoRenewableRemainder?: RenewableRemainder;
  /** Auto-renewing subscriptions. */
  autoRenewable?: AutoRenewable[];
  /** Family auto-renewing subscriptions. */
  familyAutoRenewable?: AutoRenewable[];
  /** Whether the user ever had any subscription. */
  hadAnySubscription?: boolean;
  /** Operator-billed subscriptions. */
  operator?: Operator[];
  /** The non-auto-renewing subscription, if any. */
  nonAutoRenewable?: NonAutoRenewable;
  /** Whether a trial can be started. */
  canStartTrial?: boolean;
  /** McDonald's promo flag. */
  mcdonalds?: boolean;
  /** Subscription end timestamp. */
  end?: string;

  /** @see {@link Subscription} */
  static deJson(raw: JSONValue | undefined, client?: Client): Subscription | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Subscription(client);
    assign(model, raw, ['hadAnySubscription', 'canStartTrial', 'mcdonalds', 'end']);
    model.nonAutoRenewableRemainder = RenewableRemainder.deJson(raw['nonAutoRenewableRemainder'], client) ?? undefined;
    model.autoRenewable = deList(AutoRenewable.deJson, raw['autoRenewable'], client);
    model.familyAutoRenewable = deList(AutoRenewable.deJson, raw['familyAutoRenewable'], client);
    model.operator = deList(Operator.deJson, raw['operator'], client);
    model.nonAutoRenewable = NonAutoRenewable.deJson(raw['nonAutoRenewable'], client) ?? undefined;
    reportUnknown(client, 'Subscription', raw, model);
    return model;
  }
}
