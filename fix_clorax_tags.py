import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

c = c.replace("""                                </AnimatePresence>
                                  </div>
                                )}
                              </div>
                            )}""", """                                </AnimatePresence>
                              </div>
                            )}""")

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
