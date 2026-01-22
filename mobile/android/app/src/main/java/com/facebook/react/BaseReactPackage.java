/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.ModuleHolder;
import com.facebook.react.bridge.ModuleSpec;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import javax.inject.Provider;

/** Abstract class that supports lazy loading of NativeModules by default. */
public abstract class BaseReactPackage implements ReactPackage {

  @Override
  public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
    throw new UnsupportedOperationException(
        "createNativeModules method is not supported. Use getModule() method instead.");
  }

  /**
   * The API needed for TurboModules. Given a module name, it returns an instance of {@link
   * NativeModule} for the name.
   */
  @Override
  public abstract @Nullable NativeModule getModule(
      @NonNull String name, @NonNull ReactApplicationContext reactContext);

  /** package */
  Iterable<ModuleHolder> getNativeModuleIterator(final ReactApplicationContext reactContext) {
    final Set<Map.Entry<String, ReactModuleInfo>> entrySet =
        getReactModuleInfoProvider().getReactModuleInfos().entrySet();
    final Iterator<Map.Entry<String, ReactModuleInfo>> entrySetIterator = entrySet.iterator();
    return () ->
        new Iterator<ModuleHolder>() {
          @Nullable Map.Entry<String, ReactModuleInfo> nextEntry = null;

          private void findNext() {
            while (entrySetIterator.hasNext()) {
              Map.Entry<String, ReactModuleInfo> entry = entrySetIterator.next();
              ReactModuleInfo reactModuleInfo = entry.getValue();

              if (ReactFeatureFlags.useTurboModules && reactModuleInfo.isTurboModule()) {
                continue;
              }

              nextEntry = entry;
              return;
            }
            nextEntry = null;
          }

          @Override
          public boolean hasNext() {
            if (nextEntry == null) {
              findNext();
            }
            return nextEntry != null;
          }

          @Override
          public ModuleHolder next() {
            if (nextEntry == null) {
              findNext();
            }
            if (nextEntry == null) {
              throw new NoSuchElementException("No more entries");
            }

            Map.Entry<String, ReactModuleInfo> entry = nextEntry;
            nextEntry = null;
            String name = entry.getKey();
            ReactModuleInfo reactModuleInfo = entry.getValue();

            Provider<NativeModule> provider =
                () -> BaseReactPackage.this.getModule(name, reactContext);
            return new ModuleHolder(reactModuleInfo, provider);
          }
        };
  }

  @Override
  public List<ModuleSpec> getNativeModules(
      final ReactApplicationContext reactContext, final ReactPackageLogger logger) {
    final ArrayList<ModuleSpec> modules = new ArrayList<>();
    for (ModuleHolder holder : getNativeModuleIterator(reactContext)) {
      ModuleSpec moduleSpec =
          ModuleSpec.viewManagerSpec(
              holder.getName(),
              () -> {
                if (logger != null) {
                  logger.startProcessPackage();
                }
                NativeModule nativeModule = holder.getModule();
                if (logger != null) {
                  logger.endProcessPackage();
                }
                return nativeModule;
              });
      modules.add(moduleSpec);
    }
    return modules;
  }

  @Override
  public @NonNull List<ViewManager> createViewManagers(
      @NonNull ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  /** Provide package modules info. */
  public abstract ReactModuleInfoProvider getReactModuleInfoProvider();
}
